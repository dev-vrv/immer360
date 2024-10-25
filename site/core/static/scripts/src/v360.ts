import { ajax } from "./ajax.js";

interface TextureMap {
	[index: number]: HTMLImageElement | null;
}

interface IChunkItem {
	index: number;
	base64: string;
}

interface IChunk {
	chunk: IChunkItem[];
	total_images: number;
	total_chunks: number;
	chunk_index: number;
}

class Loader360 {
	private certificate: string;
	private textureMap: TextureMap = {};
	private isFetchingFinished: boolean = false;
	private percentLoaded: number = 0;
	private totalImages: number | null = null;
	private progress = document.querySelector('.progress-bar') as HTMLElement;

	constructor(certificate: string) {
		this.certificate = certificate;
		this.preFetchChunks();
	}

	private async fetchChunk(chunkIndex: number): Promise<IChunk> {
		const data = { chunk_index: chunkIndex };
		const url = `/v360/get/${this.certificate}/`;
		const response = await ajax(url, JSON.stringify(data));
		if (!Array.isArray(response.chunk)) {
			return { chunk: [], chunk_index: 0, total_images: 0, total_chunks: 0 };
		}
		return response as IChunk;
	}

	private async preFetchChunks(chunkIndex = 0): Promise<void> {
		const response = await this.fetchChunk(chunkIndex);
		
		if (response.chunk.length === 0 || response.chunk_index >= response.total_chunks) {
			this.isFetchingFinished = true;
			return;
		}
		if (this.totalImages === null) {
			this.totalImages = response.total_images;
		}
		this.updatePercentLoaded(response.total_chunks, response.chunk_index);
		this.updateTextureMap(response.chunk);
		this.preFetchChunks(response.chunk_index + 1);
		this.updateProgress();
	}

	private updateTextureMap(chunk: IChunkItem[]): void {
		if (Object.keys(this.textureMap).length === 0) {
			for (let i = 1; i <= (this.totalImages as number); i++) {
				this.textureMap[i] = null;
			}
		}

		chunk.forEach((item) => {
			const img = new Image();
			img.src = `data:image/jpeg;base64,${item.base64}`;
			img.onload = () => {
				if (!this.textureMap[item.index]) {
					this.textureMap[item.index] = img;
				}
			};
		});
	}

	private updatePercentLoaded(total_chunks: number, current_index: number): void {
		this.percentLoaded = Math.round((current_index / total_chunks) * 100 + 7);
	}

	public getTextures(): TextureMap {
		return this.textureMap;
	}

	public isLoadingComplete(): boolean {
		return this.isFetchingFinished;
	}

	public isMapCreated(): boolean {
		return Object.keys(this.textureMap).length > 0;
	}

	public getPercentLoaded(): number {
		return this.percentLoaded;
	}

	private updateProgress(): void {
		const percent = this.getPercentLoaded();

		this.progress.style.width = `${percent}%`;
		this.progress.setAttribute('aria-valuenow', `${percent}`);

		if (percent < 100) {
			this.progress.style.opacity = '1';
		} else {
			this.progress.style.width = '100%';
			this.progress.style.opacity = '0';
			this.progress.setAttribute('aria-valuenow', `100`);
			this.progress.addEventListener('transitionend', () => {
				this.progress.parentElement?.remove();
			});
		}
	}
}

class View360 {
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D;
	private loader: Loader360;
	private textures: TextureMap = {};
	private currentIndex: number = 1;
	private isPaused: boolean = false;
	private isDragging: boolean = false;
	private startX: number = 0;
	private currentX: number = 0;
	private speedOptions = {
		speed: 50,
		lastFrameTime: 0,
	};

	constructor(certificate: string, canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.context = this.canvas.getContext("2d")!;

		this.getFirstSlide();

		this.loader = new Loader360(certificate);
		this.animate();
		this.addListeners();
	}

	private getFirstSlide(): void {
		const first = this.canvas.dataset.firstSlide as string;
		const img = new Image();
		img.src = first;
		img.onload = () => {
			const height = img.height;
			const width = img.width;
			const bodyWidth = document.body.clientWidth;
			if (width > bodyWidth) {
				this.canvas.width = bodyWidth;
				this.canvas.height = (height / width) * bodyWidth;
			}
			else {
				this.canvas.width = width;
				this.canvas.height = height;
			}
		};
	}

	private animate(currentTime = 0): void {
		if (this.isPaused) return;
		
		requestAnimationFrame(this.animate.bind(this));
	
		const timeSinceLastFrame = currentTime - this.speedOptions.lastFrameTime;
		if (timeSinceLastFrame >= this.speedOptions.speed && !this.isDragging) {
			this.nextTexture();
			this.speedOptions.lastFrameTime = currentTime;
		}
	}
	
	private updateTexture(): void {
		this.textures = this.loader.getTextures();
		const texture = this.textures[this.currentIndex];
	
		if (texture) {
			this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.context.drawImage(texture, 0, 0, this.canvas.width, this.canvas.height);
		}
	}

	private addListeners(): void {
		this.canvas.addEventListener('click', this.handlePause.bind(this));
		this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
		this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
		this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
	
		// Отслеживаем выход мыши за пределы canvas
		this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
	
		// Для touch событий аналогично
		this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
		this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
		this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
	}

	private handleMouseLeave(): void {
		// Сбрасываем состояние как если бы мышь была отпущена
		this.isDragging = false;
		this.startX = 0;
		this.currentX = 0;
	}
	

	private handleTouchStart(event: TouchEvent): void {
		this.isDragging = true;
		this.isPaused = true;

		const touch = event.touches[0];
		this.startX = touch.clientX;
		this.currentX = touch.clientX;
	}
	
	private handleTouchEnd(event: TouchEvent): void {
		this.isDragging = false;
		this.isPaused = false;
		this.startX = 0;
		this.currentX = 0;
		this.animate();
	}

	private handleTouchMove(event: TouchEvent): void {
		if (!this.isDragging) return;
	
		const touch = event.touches[0];
		this.currentX = touch.clientX;
		const deltaX = this.currentX - this.startX;
	
		if (Math.abs(deltaX) > 0.5) {
			if (deltaX > 0) {
				this.prevTexture();
			} else {
				this.nextTexture();
			}
			this.startX = this.currentX;
		}
	}

	private handlePause(): void {
		this.isPaused = !this.isPaused;
		if (!this.isPaused) {
			this.animate();
		}
	}

	private handleMouseDown(event: MouseEvent): void {
		this.isDragging = true;
		this.startX = event.clientX;
		this.currentX = event.clientX;
	}
	
	private handleMouseUp(event: MouseEvent): void {
		this.isDragging = false;
		this.startX = 0;
		this.currentX = 0;
	}

	private handleMouseMove(event: MouseEvent): void {
		if (!this.isDragging) return;

		this.currentX = event.clientX;
		const deltaX = this.currentX - this.startX;

		if (Math.abs(deltaX) > 0.5) {
			if (deltaX > 0) {
				this.prevTexture();
			} else {
				this.nextTexture();
			}
			this.startX = this.currentX;
		}
	}

	private nextTexture(): void {
		this.currentIndex++;
		this.currentIndex++;
		if (this.currentIndex > Object.keys(this.textures).length) {
			this.currentIndex = 1;
		}
		this.updateTexture();
	}

	private prevTexture(): void {
		this.currentIndex--;
		this.currentIndex--;
		if (this.currentIndex < 1) {
			this.currentIndex = Object.keys(this.textures).length;
		}
		this.updateTexture();
	}
}


document.addEventListener('DOMContentLoaded', () => {
	const certificate = document.getElementById('certificate') as HTMLInputElement;
	new View360(certificate.value, document.getElementById('v360-canvas') as HTMLCanvasElement);
});