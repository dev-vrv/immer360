import { ajax } from "./ajax.js";
// @ts-ignore
import * as THREE from "../node_modules/three/build/three.module.min.js";

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
	public totalImages: number | null = null;


	constructor(certificate: string) {
		this.certificate = certificate;
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
		this.updateTextureMap(response.chunk);
		this.preFetchChunks(response.chunk_index + 1);
	}


	private updateTextureMap(chunk: IChunkItem[]): void {
		if (Object.keys(this.textureMap).length === 0) {
			for (let i = 1; i <= (this.totalImages as number); i++) {
				this.textureMap[i] = null; // Инициализируем карту текстур пустыми значениями
			}
		}
	
		chunk.forEach((item) => {
			new THREE.TextureLoader().load(
				`data:image/png;base64,${item.base64}`,
				(texture: any) => {
					this.textureMap[item.index] = texture;
				},
			);
		});
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
}

class View360 {
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera: THREE.OrthographicCamera;
	private renderer: THREE.WebGLRenderer;
	private plane: THREE.Mesh | null = null;
	private isPaused: boolean = false;
	private speed: number = 50;
	private lastFrameTime: number = 0;
	private loader: Loader360;
	private currentIndex: number = 1;
	private textures: TextureMap = {};
    private isDragging: boolean = false;
    private startX: number = 0;
    private currentX: number = 0;

	constructor(certificate: string, containerId: string) {
		this.loader = new Loader360(certificate);
		this.container = document.getElementById(containerId) as HTMLElement;

		if (!this.container) {
			console.error(`Container with ID '${containerId}' not found`);
			return;
		}

		this.initializeScene();
		this.createPlane();
		this.animate();
		this.addListeners();
	}

	private initializeScene(): void {
		const containerWidth = this.container.clientWidth;
		const containerHeight = this.container.clientHeight;

		this.scene = new THREE.Scene();
		const aspectRatio = containerWidth / containerHeight;
		this.camera = new THREE.OrthographicCamera(-aspectRatio, aspectRatio, 1, -1, 0.1, 1000);
		this.camera.position.set(0, 0, 3);

		this.renderer = new THREE.WebGLRenderer({ alpha: true });
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.setSize(containerWidth, containerHeight);
		this.container.appendChild(this.renderer.domElement);
	}

	private createPlane(): void {
		const aspectRatio = this.container.clientWidth / this.container.clientHeight;
		const planeWidth = 2 * aspectRatio;
		const planeHeight = 2;
		const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
		const material = new THREE.MeshBasicMaterial({
			color: 0x000000, // Placeholder while waiting for textures
			side: THREE.DoubleSide,
		});

		this.plane = new THREE.Mesh(geometry, material);
		this.scene.add(this.plane);
	}

	private animate(currentTime = 0): void {
		if (this.loader.isMapCreated()) {
			requestAnimationFrame(this.animate.bind(this));
			if (this.isPaused) {
				this.renderer.render(this.scene, this.camera);
				return;
			}

			const timeSinceLastFrame = currentTime - this.lastFrameTime;
			if (timeSinceLastFrame >= this.speed) {
				this.updateTexture();
				this.lastFrameTime = currentTime;
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
