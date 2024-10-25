var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ajax } from "./ajax.js";
class Loader360 {
    constructor(certificate) {
        this.textureMap = {};
        this.isFetchingFinished = false;
        this.percentLoaded = 0;
        this.totalImages = null;
        this.progress = document.querySelector('.progress-bar');
        this.certificate = certificate;
        this.preFetchChunks();
    }
    fetchChunk(chunkIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = { chunk_index: chunkIndex };
            const url = `/v360/get/${this.certificate}/`;
            const response = yield ajax(url, JSON.stringify(data));
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
            const img = new Image();
            img.src = `data:image/jpeg;base64,${item.base64}`;
            img.onload = () => {
                if (!this.textureMap[item.index]) {
                    this.textureMap[item.index] = img;
                }
            };
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
    constructor(certificate, canvas) {
        this.textures = {};
        this.currentIndex = 1;
        this.isPaused = false;
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
        this.speedOptions = {
            speed: 50,
            lastFrameTime: 0,
        };
        this.canvas = canvas;
        this.context = this.canvas.getContext("2d");
        this.getFirstSlide();
        this.loader = new Loader360(certificate);
        this.animate();
        this.addListeners();
    }
    getFirstSlide() {
        const first = this.canvas.dataset.firstSlide;
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
    animate(currentTime = 0) {
        if (this.isPaused)
            return;
        requestAnimationFrame(this.animate.bind(this));
        const timeSinceLastFrame = currentTime - this.speedOptions.lastFrameTime;
        if (timeSinceLastFrame >= this.speedOptions.speed && !this.isDragging) {
            this.nextTexture();
            this.speedOptions.lastFrameTime = currentTime;
        }
    }
    updateTexture() {
        this.textures = this.loader.getTextures();
        const texture = this.textures[this.currentIndex];
        if (texture) {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.context.drawImage(texture, 0, 0, this.canvas.width, this.canvas.height);
        }
    }
    addListeners() {
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
    handleMouseLeave() {
        // Сбрасываем состояние как если бы мышь была отпущена
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
    }
    handleTouchStart(event) {
        this.isDragging = true;
        this.isPaused = true;
        const touch = event.touches[0];
        this.startX = touch.clientX;
        this.currentX = touch.clientX;
    }
    handleTouchEnd(event) {
        this.isDragging = false;
        this.isPaused = false;
        this.startX = 0;
        this.currentX = 0;
        this.animate();
    }
    handleTouchMove(event) {
        if (!this.isDragging)
            return;
        const touch = event.touches[0];
        this.currentX = touch.clientX;
        const deltaX = this.currentX - this.startX;
        if (Math.abs(deltaX) > 0.5) {
            if (deltaX > 0) {
                this.prevTexture();
            }
            else {
                this.nextTexture();
            }
            this.startX = this.currentX;
        }
    }
    handlePause() {
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.animate();
        }
    }
    handleMouseDown(event) {
        this.isDragging = true;
        this.startX = event.clientX;
        this.currentX = event.clientX;
    }
    handleMouseUp(event) {
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
    }
    handleMouseMove(event) {
        if (!this.isDragging)
            return;
        this.currentX = event.clientX;
        const deltaX = this.currentX - this.startX;
        if (Math.abs(deltaX) > 0.5) {
            if (deltaX > 0) {
                this.prevTexture();
            }
            else {
                this.nextTexture();
            }
            this.startX = this.currentX;
        }
    }
    nextTexture() {
        this.currentIndex++;
        this.currentIndex++;
        if (this.currentIndex > Object.keys(this.textures).length) {
            this.currentIndex = 1;
        }
        this.updateTexture();
    }
    prevTexture() {
        this.currentIndex--;
        this.currentIndex--;
        if (this.currentIndex < 1) {
            this.currentIndex = Object.keys(this.textures).length;
        }
        this.updateTexture();
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const certificate = document.getElementById('certificate');
    new View360(certificate.value, document.getElementById('v360-canvas'));
});
