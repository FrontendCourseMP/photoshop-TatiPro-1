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

        /**
     * Показывает уведомление в стиле Photoshop
     * @param {string} message - текст уведомления
     * @param {string} type - тип: 'success', 'error', 'info'
     * @param {number} duration - время показа в мс
     */
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Удаляем через указанное время
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
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
        // Счетчик для отслеживания перетаскивания
        let dragCounter = 0;
        
        ['dragenter', 'dragover'].forEach(eventName => {
            this.canvasWrapper.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragCounter++;
                this.canvasWrapper.classList.add('drag-over');
                document.querySelector('.workspace').classList.add('drag-active');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.canvasWrapper.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragCounter--;
                
                if (dragCounter <= 0) {
                    dragCounter = 0;
                    this.canvasWrapper.classList.remove('drag-over');
                    document.querySelector('.workspace').classList.remove('drag-active');
                }
            });
        });
        
        this.canvasWrapper.addEventListener('drop', (e) => {
            dragCounter = 0;
            this.canvasWrapper.classList.remove('drag-over');
            document.querySelector('.workspace').classList.remove('drag-active');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                this.processFile(file);
                this.showNotification(`Файл "${file.name}" загружен`, 'success');
            }
        });
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (file) this.processFile(file);
    }

    async processFile(file) {
        const extension = ImageUtils.getFileExtension(file.name);
        
        if (!['png', 'jpg', 'jpeg', 'gb7'].includes(extension)) {
            this.showNotification(
                `Формат .${extension} не поддерживается. Используйте PNG, JPEG или GB7`,
                'error',
                4000
            );
            return;
        }
        
        try {
            this.showNotification(`Загрузка "${file.name}"...`, 'info', 1500);
            
            if (extension === 'gb7') {
                await this.loadGB7Image(file);
            } else {
                await this.loadStandardImage(file);
            }
            
            this.statusFormat.textContent = extension.toUpperCase();
            this.showNotification(`Изображение загружено (${this.canvas.width}×${this.canvas.height})`, 'success');
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.showNotification(error.message, 'error', 5000);
        }
    }

    async loadStandardImage(file) {
        const dataURL = await ImageUtils.readFileAsDataURL(file);
        const img = await ImageUtils.loadImageFromURL(dataURL);
        
        // Создаём временный canvas для анализа загруженного изображения
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        
        this.canvas.style.display = 'block';
        this.emptyState.style.display = 'none';
        
        this.currentImage = img;
        this.currentFormat = ImageUtils.getFileExtension(file.name);
        this.downloadBtn.disabled = false;
        
        // Определяем глубину цвета
        const hasAlpha = this.imageHasAlpha(tempCtx, img.width, img.height);
        const extension = this.currentFormat.toLowerCase();
        
        let depth;
        if (extension === 'png') {
            depth = hasAlpha ? '32-bit (RGBA)' : '24-bit (RGB)';
        } else if (extension === 'jpg' || extension === 'jpeg') {
            depth = '24-bit (RGB)';
        }
        
        this.updateStatus(img.width, img.height, depth);
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
                this.showNotification(`Сохранено как ${filename}`, 'success');
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
                    this.showNotification(`Сохранено как image.${extension}`, 'success');
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

    imageHasAlpha(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Проверяем все пиксели — если хоть один имеет альфу не 255, значит есть прозрачность
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
                return true;
            }
        }
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageProcessorApp();
});