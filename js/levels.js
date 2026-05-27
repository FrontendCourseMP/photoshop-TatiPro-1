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

        this.settings = {
            master: { black: 0, white: 255, gamma: 1.0 },
            red:    { black: 0, white: 255, gamma: 1.0 },
            green:  { black: 0, white: 255, gamma: 1.0 },
            blue:   { black: 0, white: 255, gamma: 1.0 },
            alpha:  { black: 0, white: 255, gamma: 1.0 }
        };

        this.currentChannel = 'master';
        this.originalImageData = null;

        this._previewRafId = null;
        this._previewPending = false;

        this.initElements();
        this.bindEvents();
        this.histogram = new Histogram(this.histogramCanvas);
    }

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

        this.closeBtn = document.getElementById('closeLevelsBtn');
        this.resetBtn = document.getElementById('resetLevelsBtn');
        this.cancelBtn = document.getElementById('cancelLevelsBtn');
        this.applyBtn = document.getElementById('applyLevelsBtn');

        this.radioLinear = document.querySelector('input[name="histScale"][value="linear"]');
        this.radioLog = document.querySelector('input[name="histScale"][value="log"]');
    }

    bindEvents() {
        this.channelSelect.addEventListener('change', () => {
            this.switchChannel(this.channelSelect.value);
        });

        this.bindSliderInput(this.blackSlider, this.blackInput, 'black');
        this.bindSliderInput(this.whiteSlider, this.whiteInput, 'white');
        this.bindSliderGamma(this.gammaSlider, this.gammaInput);

        this.radioLinear.addEventListener('change', () => {
            this.histogram.setScale('linear');
            this.updateHistogram();
        });
        this.radioLog.addEventListener('change', () => {
            this.histogram.setScale('log');
            this.updateHistogram();
        });

        this.closeBtn.addEventListener('click', () => this.cancel());
        this.cancelBtn.addEventListener('click', () => this.cancel());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.applyBtn.addEventListener('click', () => this.apply());

        this.previewCheckbox.addEventListener('change', () => {
            if (this.previewCheckbox.checked) {
                this.requestPreviewUpdate();
            } else {
                this.restoreOriginal();
            }
        });

        this.dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this.cancel();
        });
    }

    bindSliderInput(slider, input, settingKey) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            this.updateSettingFromSlider(settingKey);
        });

        input.addEventListener('change', () => {
            let value = parseInt(input.value);
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
     * Нелинейная гамма как в Photoshop
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

    _sliderToGamma(sliderValue) {
        const relPos = sliderValue / 100;
        if (relPos <= 0.01) return 9.9;
        if (relPos >= 0.99) return 0.1;
        const gamma = Math.log(relPos) / Math.log(0.5);
        return Math.round(gamma * 100) / 100;
    }

    _gammaToSlider(gamma) {
        const clamped = Math.max(0.1, Math.min(9.9, gamma));
        return Math.pow(0.5, clamped) * 100;
    }

    updateSettingFromSlider(key) {
        const settings = this.getCurrentSettings();
        const black = parseInt(this.blackSlider.value);
        const white = parseInt(this.whiteSlider.value);

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

    getCurrentSettings() {
        return this.settings[this.currentChannel];
    }

    switchChannel(channel) {
        this.saveCurrentSettings();
        this.currentChannel = channel;
        const settings = this.getCurrentSettings();
        this.updateSlidersUI(settings);
        this.updateHistogram();
    }

    saveCurrentSettings() {
        const settings = this.getCurrentSettings();
        settings.black = parseInt(this.blackSlider.value);
        settings.white = parseInt(this.whiteSlider.value);
        settings.gamma = parseFloat(this.gammaInput.value);
    }

    updateSlidersUI(settings) {
        this.blackSlider.value = settings.black;
        this.blackInput.value = settings.black;
        this.whiteSlider.value = settings.white;
        this.whiteInput.value = settings.white;
        this.gammaSlider.value = Math.round(this._gammaToSlider(settings.gamma));
        this.gammaInput.value = settings.gamma.toFixed(2);
    }

    updateHistogram() {
        if (!this.originalImageData) return;
        this.histogram.calculate(this.originalImageData, this.currentChannel);
        this.histogram.draw();
    }

    open() {
        const imageData = this.app.ctx.getImageData(
            0, 0, this.app.canvas.width, this.app.canvas.height
        );
        this.originalImageData = imageData;

        this.lut.reset();
        this.resetAllSettings();

        this.dialog.showModal();

        this.currentChannel = 'master';
        this.channelSelect.value = 'master';
        const settings = this.getCurrentSettings();
        this.updateSlidersUI(settings);
        this.updateHistogram();
        this.previewCheckbox.checked = true;
    }

    resetAllSettings() {
        ['master', 'red', 'green', 'blue', 'alpha'].forEach(ch => {
            this.settings[ch] = { black: 0, white: 255, gamma: 1.0 };
        });
    }

    /**
     * Обновляет предпросмотр через новый LUT API (setParams)
     */
    updatePreview() {
        if (!this.originalImageData) return;

        this.lut.reset();

        ['master', 'red', 'green', 'blue', 'alpha'].forEach(ch => {
            const s = this.settings[ch];
            this.lut.setParams(ch, s.black, s.white, s.gamma);
        });

        const corrected = this.lut.apply(this.originalImageData);
        this.app.ctx.putImageData(corrected, 0, 0);
    }

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

    restoreOriginal() {
        if (!this.originalImageData) return;
        this.app.ctx.putImageData(this.originalImageData, 0, 0);
    }

    reset() {
        this.settings[this.currentChannel] = { black: 0, white: 255, gamma: 1.0 };
        const settings = this.getCurrentSettings();
        this.updateSlidersUI(settings);
        this.updateHistogram();
        if (this.previewCheckbox.checked) this.requestPreviewUpdate();
    }

    apply() {
        this.saveCurrentSettings();
        this.updatePreview();
        this.dialog.close();
        this.app.showNotification('Уровни применены', 'success');
    }

    cancel() {
        this.restoreOriginal();
        this.dialog.close();
    }
}