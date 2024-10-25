import { ajax } from "./ajax.js";
// @ts-ignore
import * as THREE from "three/build/three.module.min.js";

interface TextureMap {
	[index: number]: THREE.Texture | null;
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
	private renderer: THREE.WebGLRenderer;  // Добавляем renderer
	public totalImages: number | null = null;
	private progress = document.querySelector('.progress-bar') as HTMLElement;

	constructor(certificate: string, renderer: THREE.WebGLRenderer) {
		this.certificate = certificate;
		this.renderer = renderer;  // Инициализируем renderer
		this.preFetchChunks();
	}

	private async fetchChunk(chunkIndex: number): Promise<IChunk> {
		const response = await ajax(`/v360/get/${this.certificate}/`, {
			method: "POST",
			body: JSON.stringify({ chunk_index: chunkIndex }),
			headers: {
				"Content-Type": "application/json",
			},
		});
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
			new THREE.TextureLoader().load(
				`data:image/jpeg;base64,${item.base64}`,
				(texture: any) => {
					texture.anisotropy = 1
					texture.minFilter = THREE.LinearFilter;
					texture.magFilter = THREE.LinearFilter;
					if (!this.textureMap[item.index]) {
						this.textureMap[item.index] = texture;
					}
				},
			);
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
		}
		else {
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
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera: THREE.OrthographicCamera;
	private renderer: THREE.WebGLRenderer;
	private plane: THREE.Mesh | null = null;
	private loader: Loader360;
	private textures: TextureMap = {};
	private currentIndex: number = 1;
	private firstSlide: string;
	
	// Event variables
	private isPaused: boolean = false;
	private isDragging: boolean = false;
	private startX: number = 0;
	private currentX: number = 0;

	// Speed options
	private speedOptions = {
		speed: 40,
		lastFrameTime: 0,
	};

	constructor(certificate: string, containerId: string) {
        this.container = document.getElementById(containerId) as HTMLElement;
        this.firstSlide = this.container.getAttribute('data-first-slide') || '';

        this.initializeScene();
        this.createPlane();
        this.loader = new Loader360(certificate, this.renderer);  // Передаем renderer в Loader360
        this.animate();
        this.addListeners();
	}

	private updateSceneSize(width: number, height: number): void {
		const aspectRatio = width / height;

		// Обновляем размеры камеры на основе первого кадра
		this.camera.left = -aspectRatio;
		this.camera.right = aspectRatio;
		this.camera.top = 1;
		this.camera.bottom = -1;
		this.camera.updateProjectionMatrix();
	
		// Обновляем размер рендера
		this.renderer.setSize(width, height);
	
		// Обновляем размеры плоскости
		const planeWidth = 2 * aspectRatio;
		const planeHeight = 2;
		this.plane!.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
	}

	private initializeScene(): void {
		this.scene = new THREE.Scene();
		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000); // Временные значения для камеры
		this.camera.position.set(0, 0, 3);
	
		this.renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
		this.renderer.setClearColor(0xffffff, 0);
		this.container.appendChild(this.renderer.domElement);
	
		if (this.firstSlide) {
			const loader = new THREE.TextureLoader();
			loader.load(this.firstSlide, (texture: any) => {
				const { width, height } = texture.image;
				this.updateSceneSize(width, height);
				this.plane!.material = new THREE.MeshBasicMaterial({ map: texture });
			});
		}
	}

	private createPlane(): void {
		const aspectRatio = this.container.clientWidth / this.container.clientHeight;
		const planeWidth = 2 * aspectRatio;
		const planeHeight = 2;
		const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
		const material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			side: THREE.DoubleSide,
		});

		this.plane = new THREE.Mesh(geometry, material);
		this.scene.add(this.plane);

		if (this.firstSlide) {
			const loader = new THREE.TextureLoader();
			loader.load(this.firstSlide, (texture:any) => {
				this.plane!.material = new THREE.MeshBasicMaterial({ map: texture });
			});
		}
	}

	private animate(currentTime = 0): void {
		if (this.loader.isMapCreated()) {
			requestAnimationFrame(this.animate.bind(this));
			if (this.isPaused) {
				this.renderer.render(this.scene, this.camera);
				return;
			}

			const timeSinceLastFrame = currentTime - this.speedOptions.lastFrameTime;
			if (timeSinceLastFrame >= this.speedOptions.speed) {
				this.updateTexture();
				this.speedOptions.lastFrameTime = currentTime;
			}

			this.renderer.render(this.scene, this.camera);
		} else {
			setTimeout(() => this.animate(), 100);
		}
	}

	private updateTexture(): void {
		this.textures = this.loader.getTextures();
		if (!this.plane || Object.keys(this.textures).length === 0) return;

		const texture = this.textures[this.currentIndex];
		if (texture) {
			this.plane.material = new THREE.MeshBasicMaterial({ map: texture });
		}

		this.currentIndex++;
		if (this.currentIndex >= Object.keys(this.textures).length) {
			this.currentIndex = 1;
		}
	}

	// Event listeners
	
	private addListeners(): void {
		this.addClickListener();
		this.addDragListeners();
	}

	private addClickListener(): void {
		this.container.addEventListener("click", () => {
			this.isPaused = !this.isPaused;
		});
	}

	private addDragListeners(): void {
		// Desktop mouse events
		this.container.addEventListener('mousedown', (event: MouseEvent) => this.onMouseDown(event));
		window.addEventListener('mouseup', () => this.onMouseUp());
		window.addEventListener('mousemove', (event: MouseEvent) => this.onMouseMove(event));

		// Mobile touch events
		this.container.addEventListener('touchstart', (event: TouchEvent) => this.onTouchStart(event));
		window.addEventListener('touchend', () => this.onTouchEnd());
		window.addEventListener('touchmove', (event: TouchEvent) => this.onTouchMove(event));
	}

	// Dragging functionality

	private onMouseDown(event: MouseEvent): void {
		this.isDragging = true;
		this.startX = event.clientX;
	}

	private onMouseUp(): void {
		this.isDragging = false;
	}

	private onMouseMove(event: MouseEvent): void {
		if (!this.isDragging) return;
		this.currentX = event.clientX;
		this.handleSlideChange();
	}

	private onTouchStart(event: TouchEvent): void {
		this.isDragging = true;
		this.startX = event.touches[0].clientX;
	}

	private onTouchEnd(): void {
		this.isDragging = false;
	}

	private onTouchMove(event: TouchEvent): void {
		if (!this.isDragging) return;
		this.currentX = event.touches[0].clientX;
		this.handleSlideChange();
	}
	
	// Change slide based on the movement direction

	private handleSlideChange(): void {
		const movementThreshold = 1;
		const deltaX = this.currentX - this.startX;
		if (deltaX > movementThreshold) {
			this.moveSlideLeft();
			this.startX = this.currentX;
		} else if (deltaX < -movementThreshold) {
			this.moveSlideRight();
			this.startX = this.currentX;
		}
	}

	private moveSlideLeft(): void {
		this.currentIndex--;
		if (this.currentIndex < 1) {
			this.currentIndex = Object.keys(this.textures).length - 1;
		}
		const texture = this.textures[this.currentIndex];
		if (texture) {
			(this.plane.material as THREE.MeshBasicMaterial).map = texture;
			(this.plane.material as THREE.MeshBasicMaterial).needsUpdate = true;
		}
	}

	private moveSlideRight(): void {
		this.currentIndex++;
		if (this.currentIndex >= Object.keys(this.textures).length) {
			this.currentIndex = 1;
		}
		const texture = this.textures[this.currentIndex];
		if (texture) {
			(this.plane.material as THREE.MeshBasicMaterial).map = texture;
			(this.plane.material as THREE.MeshBasicMaterial).needsUpdate = true;
		}
	}

}

export { View360 };
