import { ImageUtils } from './utils.js';
import { GB7Decoder } from './gb7/decoder.js';
import { GB7Encoder } from './gb7/encoder.js';

class ImageProcessorApp {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasWrapper = document.getElementById('canvasWrapper');
        this.emptyState = document.getElementById('emptyState');
        
        this.currentImage = null;
        this.currentFormat = null;
        
        this.gb7Decoder = new GB7Decoder();
        this.gb7Encoder = new GB7Encoder();
        
        this.initElements();
        this.bindEvents();
        this.setupDragAndDrop();
    }

    initElements() {
        this.fileInput = document.getElementById('fileInput');
        this.loadBtn = document.getElementById('loadBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.formatSelect = document.getElementById('formatSelect');
        this.fitBtn = document.getElementById('fitBtn');
        this.actualBtn = document.getElementById('actualBtn');
        
        this.statusWidth = document.getElementById('statusWidth');
        this.statusHeight = document.getElementById('statusHeight');
        this.statusDepth = document.getElementById('statusDepth');
        this.statusFormat = document.getElementById('statusFormat');
        this.zoomLevelEl = document.getElementById('zoomLevel');
    }

    bindEvents() {
        this.loadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        this.downloadBtn.addEventListener('click', () => this.handleDownload());
        this.fitBtn.addEventListener('click', () => this.fitToScreen());
        this.actualBtn.addEventListener('click', () => this.showActualSize());
        window.addEventListener('resize', () => this.handleResize());
    }

    setupDragAndDrop() {
        ['dragenter', 'dragover'].forEach(eventName => {
            this.canvasWrapper.addEventListener(eventName, (e) => {
                e.preventDefault();
                this.canvasWrapper.style.background = 'rgba(74, 144, 217, 0.05)';
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.canvasWrapper.addEventListener(eventName, (e) => {
                e.preventDefault();
                this.canvasWrapper.style.background = '';
            });
        });
        
        this.canvasWrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) this.processFile(file);
        });
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (file) this.processFile(file);
    }

    async processFile(file) {
        const extension = ImageUtils.getFileExtension(file.name);
        
        if (!['png', 'jpg', 'jpeg', 'gb7'].includes(extension)) {
            alert('Неподдерживаемый формат. Используйте PNG, JPEG или GB7.');
            return;
        }
        
        try {
            if (extension === 'gb7') {
                await this.loadGB7Image(file);
            } else {
                await this.loadStandardImage(file);
            }
            this.statusFormat.textContent = extension.toUpperCase();
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            alert('Ошибка при загрузке файла: ' + error.message);
        }
    }

    async loadStandardImage(file) {
        const dataURL = await ImageUtils.readFileAsDataURL(file);
        const img = await ImageUtils.loadImageFromURL(dataURL);
        
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        
        this.canvas.style.display = 'block';
        this.emptyState.style.display = 'none';
        
        this.currentImage = img;
        this.currentFormat = ImageUtils.getFileExtension(file.name);
        this.downloadBtn.disabled = false;
        
        this.updateStatus(img.width, img.height, '24-bit (RGB)');
        this.fitToScreen();
    }

    async loadGB7Image(file) {
        try {
            const arrayBuffer = await ImageUtils.readFileAsArrayBuffer(file);
            const decoded = this.gb7Decoder.decode(arrayBuffer);
            const imageData = this.gb7Decoder.createImageData(decoded);
            
            // Устанавливаем размер canvas и отображаем
            this.canvas.width = decoded.width;
            this.canvas.height = decoded.height;
            this.ctx.putImageData(imageData, 0, 0);
            
            // Показываем canvas, скрываем заглушку
            this.canvas.style.display = 'block';
            this.emptyState.style.display = 'none';
            
            // Сохраняем данные для скачивания
            this.currentImage = imageData;
            this.currentFormat = 'gb7';
            this.downloadBtn.disabled = false;
            
            // Обновляем статусную строку
            const depth = decoded.hasMask ? '7-bit + mask' : '7-bit grayscale';
            this.updateStatus(decoded.width, decoded.height, depth);
            
            this.fitToScreen();
            
            console.log(`GB7 изображение загружено: ${decoded.width}x${decoded.height}`);
            
        } catch (error) {
            console.error('Ошибка декодирования GB7:', error);
            throw new Error('Ошибка чтения GB7: ' + error.message);
        }
    }

    updateStatus(width, height, depth) {
        this.statusWidth.textContent = width;
        this.statusHeight.textContent = height;
        this.statusDepth.textContent = depth;
    }

    handleDownload() {
        if (!this.currentImage && !this.canvas.width) return;
        
        const format = this.formatSelect.value;
        
        try {
            if (format === 'gb7' || format === 'gb7-mask') {
                // Для GB7 всегда берем данные с canvas
                const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                const hasMask = format === 'gb7-mask';
                const filename = hasMask ? 'image-mask.gb7' : 'image.gb7';
                this.gb7Encoder.download(imageData, filename, hasMask);
            } else {
                // Для PNG и JPEG используем стандартный метод
                const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
                const extension = format === 'jpg' ? 'jpg' : 'png';
                
                this.canvas.toBlob((blob) => {
                    if (!blob) {
                        throw new Error('Не удалось создать изображение');
                    }
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `image.${extension}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }, mimeType, 0.92); // 0.92 - качество для JPEG
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Ошибка при сохранении файла: ' + error.message);
        }
    }



    fitToScreen() {
        if (!this.currentImage) return;
        // Автоматически через CSS max-width/max-height
    }

    showActualSize() {
        if (!this.currentImage) return;
        this.canvas.style.maxWidth = 'none';
        this.canvas.style.maxHeight = 'none';
    }

    handleResize() {
        // Автоматическая адаптация через CSS
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageProcessorApp();
});