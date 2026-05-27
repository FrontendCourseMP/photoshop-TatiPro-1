import { Histogram } from './histogram.js';
import { LUT } from './lut.js';

/**
 * Модуль управления инструментом "Уровни" (Levels)
 * Управляет диалоговым окном, слайдерами, гистограммой и предпросмотром
 */
export class LevelsTool {
    /**
     * @param {Object} app - ссылка на главный класс приложения
     */
    constructor(app) {
        this.app = app;
        this.lut = new LUT();
        
        // Настройки уровней для каждого канала
        this.settings = {
            master: { black: 0, white: 255, gamma: 1.0 },
            red:    { black: 0, white: 255, gamma: 1.0 },
            green:  { black: 0, white: 255, gamma: 1.0 },
            blue:   { black: 0, white: 255, gamma: 1.0 },
            alpha:  { black: 0, white: 255, gamma: 1.0 }
        };
        
        // Текущий выбранный канал
        this.currentChannel = 'master';
        
        // Оригинальные данные изображения (до открытия диалога)
        this.originalImageData = null;
        
        // Инициализация
        this.initElements();
        this.bindEvents();

        // Для throttling предпросмотра
        this._previewRafId = null;
        this._previewPending = false;

        this.histogram = new Histogram(this.histogramCanvas);
    }

    /**
     * Инициализация ссылок на DOM-элементы
     */
    initElements() {
        this.dialog = document.getElementById('levelsDialog');
        this.channelSelect = document.getElementById('channelSelect');
        this.histogramCanvas = document.getElementById('histogramCanvas');
        this.blackSlider = document.getElementById('blackSlider');
        this.blackInput = document.getElementById('blackInput');
        this.whiteSlider = document.getElementById('whiteSlider');
        this.whiteInput = document.getElementById('whiteInput');
        this.gammaSlider = document.getElementById('gammaSlider');
        this.gammaInput = document.getElementById('gammaInput');
        this.previewCheckbox = document.getElementById('previewCheckbox');
        
        // Кнопки
        this.closeBtn = document.getElementById('closeLevelsBtn');
        this.resetBtn = document.getElementById('resetLevelsBtn');
        this.cancelBtn = document.getElementById('cancelLevelsBtn');
        this.applyBtn = document.getElementById('applyLevelsBtn');
        
        // Радио-кнопки шкалы гистограммы
        this.radioLinear = document.querySelector('input[name="histScale"][value="linear"]');
        this.radioLog = document.querySelector('input[name="histScale"][value="log"]');
    }

    /**
     * Привязка обработчиков событий
     */
    bindEvents() {
        // Выбор канала
        this.channelSelect.addEventListener('change', () => {
            this.switchChannel(this.channelSelect.value);
        });
        
        // Слайдеры и поля ввода (двусторонняя синхронизация)
        this.bindSliderInput(this.blackSlider, this.blackInput, 'black');
        this.bindSliderInput(this.whiteSlider, this.whiteInput, 'white');
        this.bindSliderGamma(this.gammaSlider, this.gammaInput);
        
        // Шкала гистограммы
        this.radioLinear.addEventListener('change', () => {
            this.histogram.setScale('linear');
            this.updateHistogram();
        });
        this.radioLog.addEventListener('change', () => {
            this.histogram.setScale('log');
            this.updateHistogram();
        });
        
        // Кнопки
        this.closeBtn.addEventListener('click', () => this.cancel());
        this.cancelBtn.addEventListener('click', () => this.cancel());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.applyBtn.addEventListener('click', () => this.apply());
        
        // Предпросмотр
        this.previewCheckbox.addEventListener('change', () => {
            if (this.previewCheckbox.checked) {
                this.requestPreviewUpdate();
            } else {
                this.restoreOriginal();
            }
        });
        
        // Закрытие по Escape
        this.dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this.cancel();
        });
    }

    /**
     * Связывает range-слайдер с числовым полем ввода
     */
    bindSliderInput(slider, input, settingKey) {
        // Слайдер → поле ввода
        slider.addEventListener('input', () => {
            input.value = slider.value;
            this.updateSettingFromSlider(settingKey);
        });
        
        // Поле ввода → слайдер
        input.addEventListener('change', () => {
            let value = parseInt(input.value);
            // Проверка границ
            if (settingKey === 'black') {
                value = Math.min(value, this.getCurrentSettings().white - 1);
            } else if (settingKey === 'white') {
                value = Math.max(value, this.getCurrentSettings().black + 1);
            }
            value = Math.max(0, Math.min(255, value));
            input.value = value;
            slider.value = value;
            this.updateSettingFromSlider(settingKey);
        });
    }

        /**
     * Связывает слайдер гаммы с полем ввода (нелинейная шкала как в Photoshop)
     * Центр слайдера (50) = гамма 1.0
     * Крайние положения: 0 = 9.9, 100 = 0.1
     */
    bindSliderGamma(slider, input) {
        slider.addEventListener('input', () => {
            const gamma = this._sliderToGamma(parseInt(slider.value));
            input.value = gamma.toFixed(2);
            this.getCurrentSettings().gamma = gamma;
            if (this.previewCheckbox.checked) this.requestPreviewUpdate();
        });

        input.addEventListener('change', () => {
            let gamma = parseFloat(input.value);
            gamma = Math.max(0.1, Math.min(9.9, gamma));
            input.value = gamma.toFixed(2);
            slider.value = Math.round(this._gammaToSlider(gamma));
            this.getCurrentSettings().gamma = gamma;
            if (this.previewCheckbox.checked) this.requestPreviewUpdate();
        });
    }

    /**
     * Преобразует положение слайдера в значение гаммы
     * @param {number} sliderValue - значение слайдера (0-100)
     * @returns {number} - гамма (0.1-9.9)
     */
    _sliderToGamma(sliderValue) {
        const relPos = sliderValue / 100;
        if (relPos <= 0.01) return 9.9;
        if (relPos >= 0.99) return 0.1;
        const gamma = Math.log(relPos) / Math.log(0.5);
        return Math.round(gamma * 100) / 100;
    }

    /**
     * Преобразует значение гаммы в положение слайдера
     * @param {number} gamma - гамма (0.1-9.9)
     * @returns {number} - положение слайдера (0-100)
     */
    _gammaToSlider(gamma) {
        const clamped = Math.max(0.1, Math.min(9.9, gamma));
        return Math.pow(0.5, clamped) * 100;
    }

 

    /**
     * Обновляет настройку при движении слайдера
     */
    updateSettingFromSlider(key) {
        const settings = this.getCurrentSettings();
        const black = parseInt(this.blackSlider.value);
        const white = parseInt(this.whiteSlider.value);
        
        // Обеспечиваем что чёрный < белый
        if (key === 'black') {
            settings.black = Math.min(black, settings.white - 1);
            this.blackSlider.value = settings.black;
            this.blackInput.value = settings.black;
        } else if (key === 'white') {
            settings.white = Math.max(white, settings.black + 1);
            this.whiteSlider.value = settings.white;
            this.whiteInput.value = settings.white;
        }
        
        if (this.previewCheckbox.checked) this.requestPreviewUpdate();
    }

    /**
     * Возвращает настройки для текущего канала
     */
    getCurrentSettings() {
        return this.settings[this.currentChannel];
    }

    /**
     * Переключает канал и обновляет интерфейс
     */
    switchChannel(channel) {
        // Сохраняем текущие настройки перед переключением
        this.saveCurrentSettings();
        
        this.currentChannel = channel;
        
        // Загружаем настройки нового канала
        const settings = this.getCurrentSettings();
        this.updateSlidersUI(settings);
        this.updateHistogram();
    }

    /**
     * Сохраняет настройки текущего канала из слайдеров
     */
    saveCurrentSettings() {
        const settings = this.getCurrentSettings();
        settings.black = parseInt(this.blackSlider.value);
        settings.white = parseInt(this.whiteSlider.value);
        settings.gamma = parseFloat(this.gammaInput.value);
    }

    /**
     * Обновляет слайдеры и поля ввода из объекта настроек
     */
    updateSlidersUI(settings) {
        this.blackSlider.value = settings.black;
        this.blackInput.value = settings.black;
        this.whiteSlider.value = settings.white;
        this.whiteInput.value = settings.white;
        this.gammaSlider.value = Math.round(settings.gamma * 100);
        this.gammaInput.value = settings.gamma.toFixed(2);
    }

    /**
     * Обновляет гистограмму для текущего канала
     */
    updateHistogram() {
        if (!this.originalImageData) return;
        
        this.histogram.calculate(this.originalImageData, this.currentChannel);
        this.histogram.draw();
    }

    /**
     * Открывает диалоговое окно
     */
    open() {
        // Сохраняем оригинальные данные изображения
        const imageData = this.app.ctx.getImageData(
            0, 0, this.app.canvas.width, this.app.canvas.height
        );
        this.originalImageData = imageData;
        
        // Сбрасываем LUT и настройки
        this.lut.reset();
        this.resetAllSettings();
        
        // Показываем диалог
        this.dialog.showModal();
        
        // Обновляем интерфейс
        this.currentChannel = 'master';
        this.channelSelect.value = 'master';
        const settings = this.getCurrentSettings();
        this.updateSlidersUI(settings);
        this.updateHistogram();
        this.previewCheckbox.checked = true;
    }

    /**
     * Сбрасывает все настройки к исходным
     */
    resetAllSettings() {
        ['master', 'red', 'green', 'blue', 'alpha'].forEach(ch => {
            this.settings[ch] = { black: 0, white: 255, gamma: 1.0 };
        });
    }

    /**
     * Обновляет предпросмотр на главном холсте
     */
    updatePreview() {
        if (!this.originalImageData) return;
        
        // Применяем LUT ко всем каналам
        this.lut.reset();
        
        // Применяем настройки каждого канала
        ['master', 'red', 'green', 'blue', 'alpha'].forEach(ch => {
            const s = this.settings[ch];
            // Пропускаем master если его настройки по умолчанию (применяем только когда он выбран)
            if (ch === 'master' && this.currentChannel !== 'master') {
                // Проверяем были ли изменены master-настройки
                if (s.black === 0 && s.white === 255 && s.gamma === 1.0) return;
            }
            if (s.black !== 0 || s.white !== 255 || s.gamma !== 1.0) {
                this.lut.applyLevels(ch, s.black, s.white, s.gamma);
            }
        });
        
        // Применяем LUT к оригинальным данным и отображаем
        const correctedData = this.lut.apply(this.originalImageData);
        this.app.ctx.putImageData(correctedData, 0, 0);
    }

     /**
     * Запрашивает обновление предпросмотра через requestAnimationFrame
     * Предотвращает множественные перерисовки за один кадр
     */
    requestPreviewUpdate() {
        this._previewPending = true;
        if (this._previewRafId !== null) return;
        this._previewRafId = requestAnimationFrame(() => {
            this._previewRafId = null;
            if (!this._previewPending) return;
            this._previewPending = false;
            this.updatePreview();
        });
    }

    /**
     * Восстанавливает оригинальное изображение на холсте
     */
    restoreOriginal() {
        if (!this.originalImageData) return;
        this.app.ctx.putImageData(this.originalImageData, 0, 0);
    }

    /**
     * Сбрасывает настройки текущего канала к исходным
     */
    reset() {
        this.settings[this.currentChannel] = { black: 0, white: 255, gamma: 1.0 };
        const settings = this.getCurrentSettings();
        this.updateSlidersUI(settings);
        this.updateHistogram();
        if (this.previewCheckbox.checked) this.requestPreviewUpdate();
    }

    /**
     * Применяет изменения и закрывает диалог
     */
    apply() {
        this.saveCurrentSettings();
        this.updatePreview();
        this.dialog.close();
        this.app.showNotification('Уровни применены', 'success');
    }

    /**
     * Отменяет изменения и закрывает диалог
     */
    cancel() {
        this.restoreOriginal();
        this.dialog.close();
    }
}