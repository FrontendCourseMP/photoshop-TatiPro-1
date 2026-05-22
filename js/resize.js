import { Interpolation } from './interpolation.js';

/**
 * Модуль управления инструментом "Изменение размера"
 * Управляет модальным окном, валидацией и применением масштабирования
 */
export class ResizeTool {
    /**
     * @param {Object} app - ссылка на главный класс приложения
     */
    constructor(app) {
        this.app = app;
        
        // Исходные размеры
        this.originalWidth = 0;
        this.originalHeight = 0;
        
        // Соотношение сторон
        this.aspectRatio = 1;
        
        // Текущие единицы измерения
        this.currentUnit = 'percent';
        
        // Инициализация
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.dialog = document.getElementById('resizeDialog');
        this.resizeOriginalPixels = document.getElementById('resizeOriginalPixels');
        this.resizeNewPixels = document.getElementById('resizeNewPixels');
        this.resizeUnitSelect = document.getElementById('resizeUnitSelect');
        this.resizeWidth = document.getElementById('resizeWidth');
        this.resizeHeight = document.getElementById('resizeHeight');
        this.keepAspectRatio = document.getElementById('keepAspectRatio');
        this.interpolationSelect = document.getElementById('interpolationSelect');
        this.interpolationTooltip = document.getElementById('interpolationTooltip');
        
        // Кнопки
        this.closeBtn = document.getElementById('closeResizeBtn');
        this.cancelBtn = document.getElementById('cancelResizeBtn');
        this.applyBtn = document.getElementById('applyResizeBtn');
    }

    bindEvents() {
        // Закрытие
        this.closeBtn.addEventListener('click', () => this.dialog.close());
        this.cancelBtn.addEventListener('click', () => this.dialog.close());
        
        // Применение
        this.applyBtn.addEventListener('click', () => this.apply());
        
        // Закрытие по Escape
        this.dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this.dialog.close();
        });
        
        // Смена единиц измерения
        this.resizeUnitSelect.addEventListener('change', () => {
            this.currentUnit = this.resizeUnitSelect.value;
            this.updateFields();
        });
        
        // Изменение ширины
        this.resizeWidth.addEventListener('input', () => {
            this.onWidthChange();
        });
        
        // Изменение высоты
        this.resizeHeight.addEventListener('input', () => {
            this.onHeightChange();
        });
        
        // Смена метода интерполяции
        this.interpolationSelect.addEventListener('change', () => {
            this.updateTooltip();
        });
    }

    /**
     * Открывает модальное окно
     */
    open() {
        // Сохраняем исходные размеры
        this.originalWidth = this.app.canvas.width;
        this.originalHeight = this.app.canvas.height;
        this.aspectRatio = this.originalWidth / this.originalHeight;
        
        // Обновляем информацию
        const originalPixels = this.originalWidth * this.originalHeight;
        this.resizeOriginalPixels.textContent = 
            `${this.originalWidth} × ${this.originalHeight} (${(originalPixels / 1000000).toFixed(2)} Мп)`;
        
        // Сбрасываем поля
        this.currentUnit = 'percent';
        this.resizeUnitSelect.value = 'percent';
        this.resizeWidth.value = 100;
        this.resizeHeight.value = 100;
        this.keepAspectRatio.checked = true;
        this.interpolationSelect.value = 'bilinear';
        
        this.updateNewPixelsInfo();
        this.updateTooltip();
        
        // Показываем диалог
        this.dialog.showModal();
    }

    /**
     * Обработчик изменения ширины
     */
    onWidthChange() {
        const width = parseFloat(this.resizeWidth.value);
        
        if (isNaN(width) || width <= 0) return;
        
        if (this.keepAspectRatio.checked) {
            if (this.currentUnit === 'percent') {
                this.resizeHeight.value = Math.round(width);
            } else {
                const newHeight = Math.round(width / this.aspectRatio);
                this.resizeHeight.value = newHeight;
            }
        }
        
        this.updateNewPixelsInfo();
    }

    /**
     * Обработчик изменения высоты
     */
    onHeightChange() {
        const height = parseFloat(this.resizeHeight.value);
        
        if (isNaN(height) || height <= 0) return;
        
        if (this.keepAspectRatio.checked) {
            if (this.currentUnit === 'percent') {
                this.resizeWidth.value = Math.round(height);
            } else {
                const newWidth = Math.round(height * this.aspectRatio);
                this.resizeWidth.value = newWidth;
            }
        }
        
        this.updateNewPixelsInfo();
    }

    /**
     * Обновляет поля при смене единиц измерения
     */
    updateFields() {
        if (this.currentUnit === 'percent') {
            this.resizeWidth.min = 12;
            this.resizeWidth.max = 300;
            this.resizeWidth.value = 100;
            this.resizeHeight.min = 12;
            this.resizeHeight.max = 300;
            this.resizeHeight.value = 100;
        } else {
            this.resizeWidth.min = 1;
            this.resizeWidth.max = 10000;
            this.resizeWidth.value = this.originalWidth;
            this.resizeHeight.min = 1;
            this.resizeHeight.max = 10000;
            this.resizeHeight.value = this.originalHeight;
        }
        
        this.updateNewPixelsInfo();
    }

    /**
     * Обновляет информацию о новом размере в пикселях
     */
    updateNewPixelsInfo() {
        const newWidth = this.getNewWidth();
        const newHeight = this.getNewHeight();
        
        if (newWidth > 0 && newHeight > 0) {
            const newPixels = newWidth * newHeight;
            this.resizeNewPixels.textContent = 
                `${newWidth} × ${newHeight} (${(newPixels / 1000000).toFixed(2)} Мп)`;
        } else {
            this.resizeNewPixels.textContent = '—';
        }
    }

    /**
     * Возвращает новую ширину в пикселях
     */
    getNewWidth() {
        const value = parseFloat(this.resizeWidth.value);
        if (isNaN(value) || value <= 0) return 0;
        
        if (this.currentUnit === 'percent') {
            return Math.round(this.originalWidth * value / 100);
        }
        return Math.round(value);
    }

    /**
     * Возвращает новую высоту в пикселях
     */
    getNewHeight() {
        const value = parseFloat(this.resizeHeight.value);
        if (isNaN(value) || value <= 0) return 0;
        
        if (this.currentUnit === 'percent') {
            return Math.round(this.originalHeight * value / 100);
        }
        return Math.round(value);
    }

    /**
     * Обновляет тултип с описанием метода интерполяции
     */
    updateTooltip() {
        const method = this.interpolationSelect.value;
        const methods = Interpolation.methods;
        
        if (methods[method]) {
            this.interpolationTooltip.textContent = methods[method].description;
        }
    }

    /**
     * Проверяет валидность введённых данных
     */
    validate() {
        const newWidth = this.getNewWidth();
        const newHeight = this.getNewHeight();
        
        if (newWidth <= 0 || newHeight <= 0) {
            this.app.showNotification('Ширина и высота должны быть больше нуля', 'error');
            return false;
        }
        
        if (newWidth > 10000 || newHeight > 10000) {
            this.app.showNotification('Максимальный размер: 10000 пикселей', 'error');
            return false;
        }
        
        const newPixels = newWidth * newHeight;
        if (newPixels > 100000000) {
            this.app.showNotification('Слишком большой размер изображения (макс. 100 Мп)', 'error');
            return false;
        }
        
        return true;
    }

    /**
     * Применяет масштабирование и закрывает диалог
     */
    apply() {
        if (!this.validate()) return;
        
        const newWidth = this.getNewWidth();
        const newHeight = this.getNewHeight();
        const method = this.interpolationSelect.value;
        
        // Получаем данные с canvas
        const imageData = this.app.ctx.getImageData(
            0, 0, this.app.canvas.width, this.app.canvas.height
        );
        
        // Масштабируем
        const scaledData = Interpolation.scale(imageData, newWidth, newHeight, method);
        
        // Обновляем canvas
        this.app.canvas.width = newWidth;
        this.app.canvas.height = newHeight;
        this.app.ctx.putImageData(scaledData, 0, 0);
        
        // Обновляем статус
        this.app.updateStatus(newWidth, newHeight, this.app.statusDepth.textContent);
        
        // Обновляем зум
        this.app.updateZoomDisplay();
        this.app.fitToScreen();
        
        // Закрываем диалог
        this.dialog.close();
        
        this.app.showNotification(
            `Размер изменён: ${newWidth} × ${newHeight} px`, 
            'success'
        );
    }
}