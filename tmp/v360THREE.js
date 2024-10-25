var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ajax } from "../site/core/static/scripts/src/ajax.js";
// @ts-ignore
import * as THREE from "three/build/three.module.min.js";
class Loader360 {
    constructor(certificate, renderer) {
        this.textureMap = {};
        this.isFetchingFinished = false;
        this.percentLoaded = 0;
        this.totalImages = null;
        this.progress = document.querySelector('.progress-bar');
        this.certificate = certificate;
        this.renderer = renderer; // Инициализируем renderer
        this.preFetchChunks();
    }
    fetchChunk(chunkIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield ajax(`/v360/get/${this.certificate}/`, {
                method: "POST",
                body: JSON.stringify({ chunk_index: chunkIndex }),
                headers: {
                    "Content-Type": "application/json",
                },
            });
            if (!Array.isArray(response.chunk)) {
                return { chunk: [], chunk_index: 0, total_images: 0, total_chunks: 0 };
            }
            return response;
        });
    }
    preFetchChunks() {
        return __awaiter(this, arguments, void 0, function* (chunkIndex = 0) {
            const response = yield this.fetchChunk(chunkIndex);
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
        });
    }
    updateTextureMap(chunk) {
        if (Object.keys(this.textureMap).length === 0) {
            for (let i = 1; i <= this.totalImages; i++) {
                this.textureMap[i] = null;
            }
        }
        chunk.forEach((item) => {
            new THREE.TextureLoader().load(`data:image/jpeg;base64,${item.base64}`, (texture) => {
                texture.anisotropy = 1;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                if (!this.textureMap[item.index]) {
                    this.textureMap[item.index] = texture;
                }
            });
        });
    }
    updatePercentLoaded(total_chunks, current_index) {
        this.percentLoaded = Math.round((current_index / total_chunks) * 100 + 7);
    }
    getTextures() {
        return this.textureMap;
    }
    isLoadingComplete() {
        return this.isFetchingFinished;
    }
    isMapCreated() {
        return Object.keys(this.textureMap).length > 0;
    }
    getPercentLoaded() {
        return this.percentLoaded;
    }
    updateProgress() {
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
                var _a;
                (_a = this.progress.parentElement) === null || _a === void 0 ? void 0 : _a.remove();
            });
        }
    }
}
class View360 {
    constructor(certificate, containerId) {
        this.plane = null;
        this.textures = {};
        this.currentIndex = 1;
        // Event variables
        this.isPaused = false;
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
        // Speed options
        this.speedOptions = {
            speed: 40,
            lastFrameTime: 0,
        };
        this.container = document.getElementById(containerId);
        this.firstSlide = this.container.getAttribute('data-first-slide') || '';
        this.initializeScene();
        this.createPlane();
        this.loader = new Loader360(certificate, this.renderer); // Передаем renderer в Loader360
        this.animate();
        this.addListeners();
    }
    updateSceneSize(width, height) {
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
        this.plane.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    }
    initializeScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000); // Временные значения для камеры
        this.camera.position.set(0, 0, 3);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
        this.renderer.setClearColor(0xffffff, 0);
        this.container.appendChild(this.renderer.domElement);
        if (this.firstSlide) {
            const loader = new THREE.TextureLoader();
            loader.load(this.firstSlide, (texture) => {
                const { width, height } = texture.image;
                this.updateSceneSize(width, height);
                this.plane.material = new THREE.MeshBasicMaterial({ map: texture });
            });
        }
    }
    createPlane() {
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
            loader.load(this.firstSlide, (texture) => {
                this.plane.material = new THREE.MeshBasicMaterial({ map: texture });
            });
        }
    }
    animate(currentTime = 0) {
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
        }
        else {
            setTimeout(() => this.animate(), 100);
        }
    }
    updateTexture() {
        this.textures = this.loader.getTextures();
        if (!this.plane || Object.keys(this.textures).length === 0)
            return;
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
    addListeners() {
        this.addClickListener();
        this.addDragListeners();
    }
    addClickListener() {
        this.container.addEventListener("click", () => {
            this.isPaused = !this.isPaused;
        });
    }
    addDragListeners() {
        // Desktop mouse events
        this.container.addEventListener('mousedown', (event) => this.onMouseDown(event));
        window.addEventListener('mouseup', () => this.onMouseUp());
        window.addEventListener('mousemove', (event) => this.onMouseMove(event));
        // Mobile touch events
        this.container.addEventListener('touchstart', (event) => this.onTouchStart(event));
        window.addEventListener('touchend', () => this.onTouchEnd());
        window.addEventListener('touchmove', (event) => this.onTouchMove(event));
    }
    // Dragging functionality
    onMouseDown(event) {
        this.isDragging = true;
        this.startX = event.clientX;
    }
    onMouseUp() {
        this.isDragging = false;
    }
    onMouseMove(event) {
        if (!this.isDragging)
            return;
        this.currentX = event.clientX;
        this.handleSlideChange();
    }
    onTouchStart(event) {
        this.isDragging = true;
        this.startX = event.touches[0].clientX;
    }
    onTouchEnd() {
        this.isDragging = false;
    }
    onTouchMove(event) {
        if (!this.isDragging)
            return;
        this.currentX = event.touches[0].clientX;
        this.handleSlideChange();
    }
    // Change slide based on the movement direction
    handleSlideChange() {
        const movementThreshold = 1;
        const deltaX = this.currentX - this.startX;
        if (deltaX > movementThreshold) {
            this.moveSlideLeft();
            this.startX = this.currentX;
        }
        else if (deltaX < -movementThreshold) {
            this.moveSlideRight();
            this.startX = this.currentX;
        }
    }
    moveSlideLeft() {
        this.currentIndex--;
        if (this.currentIndex < 1) {
            this.currentIndex = Object.keys(this.textures).length - 1;
        }
        const texture = this.textures[this.currentIndex];
        if (texture) {
            this.plane.material.map = texture;
            this.plane.material.needsUpdate = true;
        }
    }
    moveSlideRight() {
        this.currentIndex++;
        if (this.currentIndex >= Object.keys(this.textures).length) {
            this.currentIndex = 1;
        }
        const texture = this.textures[this.currentIndex];
        if (texture) {
            this.plane.material.map = texture;
            this.plane.material.needsUpdate = true;
        }
    }
}
export { View360 };
