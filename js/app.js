import { ImageUtils } from './utils.js';
import { GB7Decoder } from './gb7/decoder.js';
import { GB7Encoder } from './gb7/encoder.js';
import { ChannelManager } from './channels.js';
import { PipetteTool } from './pipette.js';
import { LevelsTool } from './levels.js';  
import { ResizeTool } from './resize.js'; 
import { Interpolation } from './interpolation.js';
import { FilterTool } from './filterTool.js';

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
        
        this.channelManager = new ChannelManager();
        this.pipetteTool = null; // Инициализируем после загрузки изображения
        this.levelsTool = null;
        this.resizeTool = null;
        this.filterTool = null;

        this.initElements();
        this.bindEvents();
        this.setupDragAndDrop();
        this.setupChannelsPanel();

        this.originalCanvasWidth = 0;
        this.originalCanvasHeight = 0;

    }

    initElements() {
        // Основные элементы
        this.fileInput = document.getElementById('fileInput');
        this.loadBtn = document.getElementById('loadBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.formatSelect = document.getElementById('formatSelect');
        this.fitBtn = document.getElementById('fitBtn');
        this.actualBtn = document.getElementById('actualBtn');
        
        // Статус бар
        this.statusWidth = document.getElementById('statusWidth');
        this.statusHeight = document.getElementById('statusHeight');
        this.statusDepth = document.getElementById('statusDepth');
        this.statusFormat = document.getElementById('statusFormat');
        this.zoomLevelEl = document.getElementById('zoomLevel');
        
        // Кнопка пипетки
        this.pipetteBtn = document.getElementById('pipetteBtn');

        this.levelsBtn = document.getElementById('levelsBtn');
        
        this.resizeBtn = document.getElementById('resizeBtn');

        this.filterBtn = document.getElementById('filterBtn');

        // Панель информации пипетки
        this.infoCoords = document.getElementById('infoCoords');
        this.infoRGB = document.getElementById('infoRGB');
        this.infoHEX = document.getElementById('infoHEX');
        this.infoLAB = document.getElementById('infoLAB');
        this.colorPreview = document.getElementById('colorPreview');
        
        // Чекбоксы каналов
        this.channelCheckboxes = document.querySelectorAll('.channel-checkbox');
        
        // Превью каналов
        this.previewRed = document.getElementById('previewRed');
        this.previewGreen = document.getElementById('previewGreen');
        this.previewBlue = document.getElementById('previewBlue');
        this.previewAlpha = document.getElementById('previewAlpha');

        this.zoomSlider = document.getElementById('zoomSlider');
        this.zoomInput = document.getElementById('zoomInput');

        this.channelsPanelToggle = document.getElementById('channelsPanelToggle');
        this.channelsPanelContent = document.getElementById('channelsPanelContent');
    }


    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
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
        
        // Кнопка пипетки
        this.pipetteBtn.addEventListener('click', () => this.togglePipette());

        this.levelsBtn.addEventListener('click', () => this.openLevels());

        this.resizeBtn.addEventListener('click', () => this.openResize());

        this.filterBtn.addEventListener('click', () => this.openFilter());

        this.zoomSlider.addEventListener('input', () => {
            const value = parseInt(this.zoomSlider.value, 10);
            this.zoomInput.value = value;
            this.setZoom(value);
        });

        this.zoomInput.addEventListener('change', () => {
            let value = parseInt(this.zoomInput.value, 10);
            if (!Number.isFinite(value)) value = 100;
            value = Math.max(12, Math.min(300, value));
            this.zoomInput.value = value;
            this.zoomSlider.value = value;
            this.setZoom(value);
        });

        this.channelsPanelToggle.addEventListener('click', () => {
            if (this.channelsPanelContent.style.display === 'none') {
                this.channelsPanelContent.style.display = '';
                this.channelsPanelToggle.textContent = '▸';
            } else {
                this.channelsPanelContent.style.display = 'none';
                this.channelsPanelToggle.textContent = '▾';
            }
        });
    }

    setupDragAndDrop() {
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

    /**
     * Настройка панели каналов — обработчики чекбоксов
     */
    setupChannelsPanel() {
        this.channelCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const channel = e.target.dataset.channel;
                const isEnabled = e.target.checked;
                
                // Обновляем состояние в ChannelManager
                this.channelManager.channels[channel] = isEnabled;
                
                // Подсвечиваем/затемняем элемент канала
                const channelItem = e.target.closest('.channel-item');
                if (isEnabled) {
                    channelItem.classList.remove('disabled');
                } else {
                    channelItem.classList.add('disabled');
                }
                
                // Обновляем главный холст
                this.updateCanvasFromChannels();
            });
        });
    }

    /**
     * Обновляет главный холст с учётом состояния каналов
     */
    updateCanvasFromChannels() {
        if (!this.channelManager.originalImageData) return;
        
        const newImageData = this.channelManager.applyChannels();
        if (newImageData) {
            this.ctx.putImageData(newImageData, 0, 0);
        }
    }

    /**
     * Обновляет превью каналов в панели
     */
    updateChannelPreviews() {
        if (!this.channelManager.originalImageData) return;
        
        const previewWidth = 60;
        const previewHeight = 40;
        
        // Для каждого канала создаём превью и отображаем в соответствующем canvas
        const channels = ['red', 'green', 'blue', 'alpha'];
        const previews = [this.previewRed, this.previewGreen, this.previewBlue, this.previewAlpha];
        
        channels.forEach((channel, index) => {
            const previewCanvas = this.channelManager.createPreviewCanvas(
                channel, 
                previewWidth, 
                previewHeight
            );
            
            if (previewCanvas && previews[index]) {
                const previewCtx = previews[index].getContext('2d');
                previews[index].width = previewWidth;
                previews[index].height = previewHeight;
                previewCtx.drawImage(previewCanvas, 0, 0);
            }
        });
    }

    /**
     * Включает/выключает инструмент пипетка
     */
    togglePipette() {
        if (!this.pipetteTool) {
            this.pipetteTool = new PipetteTool(this.canvas, this.channelManager);
            this.pipetteTool.onColorPick = (data) => this.updateInfoPanel(data);
        }
        
        const isActive = this.pipetteTool.toggle();
        
        // Подсвечиваем кнопку когда инструмент активен
        if (isActive) {
            this.pipetteBtn.classList.add('active-tool');
            this.showNotification('Пипетка активирована. Кликните по изображению', 'info');
        } else {
            this.pipetteBtn.classList.remove('active-tool');
        }
    }

    openLevels() {
        if (!this.canvas.width) return;
        
        if (!this.levelsTool) {
            this.levelsTool = new LevelsTool(this);
        }
        
        this.levelsTool.open();
    }

    /**
     * Открывает модальное окно "Изменение размера"
     */
    openResize() {
        if (!this.canvas.width) return;
        
        if (!this.resizeTool) {
            this.resizeTool = new ResizeTool(this);
        }
        
        this.resizeTool.open();
    }

    /**
     * Открывает диалоговое окно "Фильтры"
     */
    openFilter() {
        if (!this.canvas.width) return;

        if (!this.filterTool) {
            this.filterTool = new FilterTool(this);
        }

        this.filterTool.open();
    }

    /**
     * Обновляет отображение масштаба в статусной строке
     */

    setZoom(percentValue) {
        if (!this.originalCanvasWidth || !this.originalCanvasHeight) return;
        
        const scale = percentValue / 100;
        const newWidth = Math.round(this.originalCanvasWidth * scale);
        const newHeight = Math.round(this.originalCanvasHeight * scale);
        
        this.canvas.style.width = newWidth + 'px';
        this.canvas.style.height = newHeight + 'px';
        
        const wrapper = this.canvasWrapper;
        
        // Центрируем canvas
        const left = Math.max(0, (wrapper.clientWidth - newWidth) / 2);
        const top = Math.max(0, (wrapper.clientHeight - newHeight) / 2);
        this.canvas.style.left = left + 'px';
        this.canvas.style.top = top + 'px';
        
        // Скролл только если canvas больше wrapper
        wrapper.scrollLeft = Math.max(0, (newWidth - wrapper.clientWidth) / 2);
        wrapper.scrollTop = Math.max(0, (newHeight - wrapper.clientHeight) / 2);
        
        if (this.zoomLevelEl) {
            this.zoomLevelEl.textContent = percentValue + '%';
        }
    }

 

    /**
     * Обновляет панель информации о пикселе
     */
    updateInfoPanel(data) {
        this.infoCoords.textContent = `X: ${data.x}, Y: ${data.y}`;
        this.infoRGB.textContent = `R: ${data.r}, G: ${data.g}, B: ${data.b}`;
        this.infoHEX.textContent = data.hex;
        this.infoLAB.textContent = `L: ${data.lab.L}, a: ${data.lab.a}, b: ${data.lab.b}`;
        
        // Обновляем превью цвета
        this.colorPreview.style.backgroundColor = `rgb(${data.r}, ${data.g}, ${data.b})`;
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
            
            // Деактивируем пипетку при загрузке нового изображения
            if (this.pipetteTool && this.pipetteTool.active) {
                this.pipetteTool.deactivate();
                this.pipetteBtn.classList.remove('active-tool');
            }
            
            if (extension === 'gb7') {
                await this.loadGB7Image(file);
            } else {
                await this.loadStandardImage(file);
            }
            
            this.statusFormat.textContent = extension.toUpperCase();
            
            // Инициализируем ChannelManager данными с холста
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const channelCount = ImageUtils.detectChannelCount(imageData);

            this.channelManager.setOriginalImage(imageData, channelCount);
            this.updateChannelPreviews();
            
            // Сбрасываем чекбоксы каналов
            this.resetChannelCheckboxes(channelCount);
            
            // Инициализируем пипетку заново
            this.pipetteTool = null;
            
            this.showNotification(`Изображение загружено (${this.canvas.width}×${this.canvas.height})`, 'success');
            
            this.levelsBtn.disabled = false;
            this.resizeBtn.disabled = false;
            this.filterBtn.disabled = false;

        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.showNotification(error.message, 'error', 5000);
        }
    }

    /**
     * Сбрасывает чекбоксы каналов в зависимости от количества каналов
     * @param {number} channelCount - количество каналов (1-4)
     */

    resetChannelCheckboxes(channelCount) {
        const redEl = document.querySelector('[data-channel="red"]').closest('.channel-item');
        const greenEl = document.querySelector('[data-channel="green"]').closest('.channel-item');
        const blueEl = document.querySelector('[data-channel="blue"]').closest('.channel-item');
        const alphaEl = document.querySelector('[data-channel="alpha"]').closest('.channel-item');

        const isGray = channelCount === 1 || channelCount === 2;
        const hasRGB = channelCount >= 3;
        const hasAlpha = channelCount === 2 || channelCount === 4;

        if (isGray) {
            // Показываем red как "Серый"
            redEl.style.display = '';
            redEl.querySelector('.channel-label').lastChild.textContent = ' Серый';
            redEl.querySelector('.red-dot').style.background = '#999';
            document.querySelector('[data-channel="red"]').checked = true;

            greenEl.style.display = 'none';
            blueEl.style.display = 'none';
        } else {
            // Восстанавливаем RGB
            redEl.style.display = hasRGB ? '' : 'none';
            redEl.querySelector('.channel-label').lastChild.textContent = ' Красный';
            redEl.querySelector('.red-dot').style.background = '';
            document.querySelector('[data-channel="red"]').checked = hasRGB;

            greenEl.style.display = hasRGB ? '' : 'none';
            document.querySelector('[data-channel="green"]').checked = hasRGB;

            blueEl.style.display = hasRGB ? '' : 'none';
            document.querySelector('[data-channel="blue"]').checked = hasRGB;
        }

        alphaEl.style.display = hasAlpha ? '' : 'none';
        document.querySelector('[data-channel="alpha"]').checked = hasAlpha;

        // Синхронизируем channelManager.channels с чекбоксами
        this.channelManager.channels.red = document.querySelector('[data-channel="red"]').checked;
        this.channelManager.channels.green = document.querySelector('[data-channel="green"]').checked;
        this.channelManager.channels.blue = document.querySelector('[data-channel="blue"]').checked;
        this.channelManager.channels.alpha = document.querySelector('[data-channel="alpha"]').checked;
    }

 
    async loadStandardImage(file) {
        const dataURL = await ImageUtils.readFileAsDataURL(file);
        const img = await ImageUtils.loadImageFromURL(dataURL);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.originalCanvasWidth = img.width;
        this.originalCanvasHeight = img.height;
        this.ctx.drawImage(img, 0, 0);
        
        this.canvas.style.display = 'block';
        this.emptyState.style.display = 'none';
        
        this.currentImage = img;
        this.currentFormat = ImageUtils.getFileExtension(file.name);
        this.downloadBtn.disabled = false;
        this.levelsBtn.disabled = false;
        this.resizeBtn.disabled = false;
        this.filterBtn.disabled = false;
        
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
            
            // Сохраняем декодированные данные для определения каналов
            this.lastDecodedGB7 = decoded;
            
            this.canvas.width = decoded.width;
            this.canvas.height = decoded.height;
            this.originalCanvasWidth = decoded.width;
            this.originalCanvasHeight = decoded.height;
            this.ctx.putImageData(imageData, 0, 0);
            
            this.canvas.style.display = 'block';
            this.emptyState.style.display = 'none';
            
            this.currentImage = imageData;
            this.currentFormat = 'gb7';
            this.downloadBtn.disabled = false;
            this.levelsBtn.disabled = false;
            this.resizeBtn.disabled = false;
            this.filterBtn.disabled = false;
            
            const depth = decoded.hasMask ? '7-bit + mask' : '7-bit grayscale';
            this.updateStatus(decoded.width, decoded.height, depth);
            
            this.fitToScreen();
            
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
                const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                const hasMask = format === 'gb7-mask';
                const filename = hasMask ? 'image-mask.gb7' : 'image.gb7';
                this.gb7Encoder.download(imageData, filename, hasMask);
                this.showNotification(`Сохранено как ${filename}`, 'success');
            } else {
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
                }, mimeType, 0.92);
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.showNotification(error.message, 'error', 4000);
        }
    }

    fitToScreen() {
        if (!this.originalCanvasWidth || !this.originalCanvasHeight) return;
        
        const wrapper = this.canvasWrapper;
        const wrapperWidth = wrapper.clientWidth - 100;
        const wrapperHeight = wrapper.clientHeight - 100;
        
        const scaleX = wrapperWidth / this.originalCanvasWidth;
        const scaleY = wrapperHeight / this.originalCanvasHeight;
        let scale = Math.min(scaleX, scaleY, 3.0);
        scale = Math.max(scale, 0.12);
        
        const percent = Math.round(scale * 100);
        this.setZoom(percent);
        
        if (this.zoomSlider) this.zoomSlider.value = percent;
        if (this.zoomInput) this.zoomInput.value = percent;
    }

    showActualSize() {
        if (!this.originalCanvasWidth || !this.originalCanvasHeight) return;
        
        this.setZoom(100);
        
        if (this.zoomSlider) this.zoomSlider.value = 100;
        if (this.zoomInput) this.zoomInput.value = 100;
    }

    handleResize() {
        if (this.originalCanvasWidth && this.originalCanvasHeight) {
            const wrapper = this.canvasWrapper;
            const currentWidth = parseInt(this.canvas.style.width);
            const currentHeight = parseInt(this.canvas.style.height);
            
            const left = Math.max(0, (wrapper.clientWidth - currentWidth) / 2);
            const top = Math.max(0, (wrapper.clientHeight - currentHeight) / 2);
            this.canvas.style.left = left + 'px';
            this.canvas.style.top = top + 'px';
            
            wrapper.scrollLeft = Math.max(0, (currentWidth - wrapper.clientWidth) / 2);
            wrapper.scrollTop = Math.max(0, (currentHeight - wrapper.clientHeight) / 2);
        }
    }

    imageHasAlpha(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

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