import { ajax } from "./ajax.js";
// @ts-ignore
import * as THREE from "../node_modules/three/build/three.module.min.js";

class V360Viewer {
	private isPlaneCreated: boolean = false;
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera: THREE.OrthographicCamera;
	private renderer: THREE.WebGLRenderer;
	private allTextures: THREE.Texture[] = [];
	private currentIndex: number = 0;
	private isDragging: boolean = false;
	private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
	private autoRotate: boolean = true;
	private isPaused: boolean = false;
	private certificate: string;
	private speed: number = 0.04;

	constructor(certificate: string, containerId: string) {
		this.certificate = certificate;
		this.container = document.getElementById(containerId) as HTMLElement;

		if (!this.container) {
			console.error(`Container with ID '${containerId}' not found`);
			return;
		}

		this.initializeScene();
		this.loadNextChunk(0);
		this.addEventListeners();
		this.animate();
		this.changeImage();
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
	
	private updateTexture(): void {
		if (this.isPlaneCreated) {
			const plane = this.scene.children[0] as THREE.Mesh;
			if (plane && plane.material && this.allTextures[this.currentIndex]) {
				const material = plane.material as THREE.MeshBasicMaterial;
				material.map = this.allTextures[this.currentIndex];
				material.needsUpdate = true;
				this.renderer.render(this.scene, this.camera);
			} else {
				console.warn("Cannot update texture: Plane or texture is undefined");
			}
		}
	}

	private createPlane(): void {
		const aspectRatio = this.container.clientWidth / this.container.clientHeight;
		const planeWidth = 2 * aspectRatio;
		const planeHeight = 2;
		const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
		const material = new THREE.MeshBasicMaterial({
			map: this.allTextures[0],
			side: THREE.DoubleSide,
		});
		const plane = new THREE.Mesh(geometry, material);
		this.scene.add(plane);
		this.renderer.render(this.scene, this.camera);
	}

	private changeImage(): void {
		if (this.autoRotate && !this.isPaused && this.isPlaneCreated) {
			// Добавляем проверку на создание плоскости
			this.currentIndex = (this.currentIndex + 1) % this.allTextures.length;
			this.updateTexture();
		}
		setTimeout(this.changeImage.bind(this), this.speed * 1000);
	}

	private animate(): void {
		requestAnimationFrame(this.animate.bind(this));
		this.renderer.render(this.scene, this.camera);
	}

	// Animation

	private async loadNextChunk(chunkIndex: number): Promise<void> {
		const chunk = await this.getChunk(chunkIndex);
		if (chunk && chunk.length === 0) return; // Если чанков больше нет, завершить загрузку

		const textures = await this.preloadImages(chunk);
		this.allTextures = [...this.allTextures, ...textures];

		if (chunkIndex === 0) {
			this.createPlane();
			this.isPlaneCreated = true; // Плоскость создана
		}

		// Загружаем следующий чанк
		this.loadNextChunk(chunkIndex + 1);
	}

	private async getChunk(chunkIndex: number): Promise<string[]> {
		const response = await ajax(`/v360/get/${this.certificate}/`, {
			method: "POST",
			body: JSON.stringify({ chunk_index: chunkIndex }),
			headers: {
				"Content-Type": "application/json",
			},
		});
		return response.chunk as string[];
	}

	private async preloadImages(base64Chunk: string[]): Promise<THREE.Texture[]> {
		const loader = new THREE.TextureLoader();
		const textures: Promise<THREE.Texture>[] = base64Chunk.map((base64) => {
			const imageSrc = `data:image/png;base64,${base64}`;
			return new Promise((resolve) => {
				loader.load(imageSrc, resolve);
			});
		});

		return Promise.all(textures);
	}

	// Event handlers

	private addEventListeners(): void {
		this.container.addEventListener("mousedown", this.onMouseDown.bind(this), false);
		this.container.addEventListener("mousemove", this.onMouseMove.bind(this), false);
		this.container.addEventListener("mouseup", this.onMouseUp.bind(this), false);
		this.container.addEventListener("mouseleave", this.onMouseUp.bind(this), false);
		this.container.addEventListener("click", this.onClick.bind(this), false);

		window.addEventListener("resize", this.onResize.bind(this));
	}

	private onMouseDown(event: MouseEvent): void {
		this.isDragging = true;
		this.autoRotate = false;
	}

	private onMouseMove(event: MouseEvent): void {
		if (!this.isDragging) return;

		const deltaMove = {
			x: event.offsetX - this.previousMousePosition.x,
			y: event.offsetY - this.previousMousePosition.y,
		};

		// По умолчанию: влево (x < 0) — назад, вправо (x > 0) — вперёд
		let directionX = deltaMove.x > 0 ? -1 : 1;

		this.currentIndex = (this.currentIndex + directionX + this.allTextures.length) % this.allTextures.length;

		this.updateTexture();

		this.previousMousePosition = {
			x: event.offsetX,
			y: event.offsetY,
		};
	}

	private onMouseUp(): void {
		this.isDragging = false;
		this.autoRotate = true;
	}

	private onClick(): void {
		this.isPaused = !this.isPaused;
	}

	private onResize(): void {
		const newWidth = this.container.clientWidth;
		const newHeight = this.container.clientHeight;
		const newAspectRatio = newWidth / newHeight;

		if (newWidth === 0 || newHeight === 0) {
			console.error("Container has zero width or height on resize");
			return;
		}

		this.renderer.setSize(newWidth, newHeight);
		this.camera.left = -newAspectRatio;
		this.camera.right = newAspectRatio;
		this.camera.updateProjectionMatrix();
	}

}

document.addEventListener("DOMContentLoaded", () => {
	const certificate = document.querySelector<HTMLInputElement>("#certificate")?.value || "";
	if (certificate) {
		new V360Viewer(certificate, "v360-container");
	} else {
		console.error("Certificate not provided.");
	}
});
