import { Convolution } from './convolution.js';

/**
 * Модуль управления инструментом "Фильтры"
 * Управляет диалоговым окном, пресетами, ядром свёртки и предпросмотром
 */
export class FilterTool {
    /**
     * @param {Object} app - ссылка на главный класс приложения
     */
    constructor(app) {
        this.app = app;

        // Оригинальные данные изображения
        this.originalImageData = null;

        // Текущее ядро 3×3
        this.kernel = [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0]
        ];

        // Пресеты ядер
        this.presets = {
            identity: {
                name: 'Тождественное отображение',
                kernel: [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 0, 0]
                ]
            },
            sharpen: {
                name: 'Повышение резкости',
                kernel: [
                    [ 0, -1,  0],
                    [-1,  5, -1],
                    [ 0, -1,  0]
                ]
            },
            gauss3: {
                name: 'Фильтр Гаусса (3×3)',
                kernel: [
                    [1, 2, 1],
                    [2, 4, 2],
                    [1, 2, 1]
                ]
            },
            boxBlur: {
                name: 'Прямоугольное размытие',
                kernel: [
                    [1, 1, 1],
                    [1, 1, 1],
                    [1, 1, 1]
                ]
            },
            prewittX: {
                name: 'Оператор Прюитта (X)',
                kernel: [
                    [-1, 0, 1],
                    [-1, 0, 1],
                    [-1, 0, 1]
                ]
            },
            prewittY: {
                name: 'Оператор Прюитта (Y)',
                kernel: [
                    [-1, -1, -1],
                    [ 0,  0,  0],
                    [ 1,  1,  1]
                ]
            }
        };

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.dialog = document.getElementById('filterDialog');
        this.filterPreset = document.getElementById('filterPreset');
        this.edgeMode = document.getElementById('edgeMode');
        this.filterPreview = document.getElementById('filterPreview');

        // Ячейки ядра
        this.kernelCells = [];
        for (let y = 0; y < 3; y++) {
            this.kernelCells[y] = [];
            for (let x = 0; x < 3; x++) {
                this.kernelCells[y][x] = document.getElementById(`k${y}${x}`);
            }
        }

        // Чекбоксы каналов
        this.filterChannels = document.querySelectorAll('.filter-channel');

        // Кнопки
        this.closeBtn = document.getElementById('closeFilterBtn');
        this.resetBtn = document.getElementById('resetFilterBtn');
        this.cancelBtn = document.getElementById('cancelFilterBtn');
        this.applyBtn = document.getElementById('applyFilterBtn');
    }

    bindEvents() {
        // Выбор пресета
        this.filterPreset.addEventListener('change', () => {
            this.loadPreset(this.filterPreset.value);
            if (this.filterPreview.checked) this.updatePreview();
        });

        // Изменение ячеек ядра
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                this.kernelCells[y][x].addEventListener('input', () => {
                    this.readKernelFromInputs();
                    if (this.filterPreview.checked) this.updatePreview();
                });
            }
        }

        // Edge mode
        this.edgeMode.addEventListener('change', () => {
            if (this.filterPreview.checked) this.updatePreview();
        });

        // Предпросмотр
        this.filterPreview.addEventListener('change', () => {
            if (this.filterPreview.checked) {
                this.updatePreview();
            } else {
                this.restoreOriginal();
            }
        });

        // Кнопки
        this.closeBtn.addEventListener('click', () => this.cancel());
        this.cancelBtn.addEventListener('click', () => this.cancel());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.applyBtn.addEventListener('click', () => this.apply());

        // Escape
        this.dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this.cancel();
        });
    }

    /**
     * Загружает пресет в поля ввода
     */
    loadPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;

        this.kernel = preset.kernel.map(row => [...row]);
        this.updateKernelInputs();
    }

    /**
     * Обновляет поля ввода из текущего ядра
     */
    updateKernelInputs() {
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                this.kernelCells[y][x].value = this.kernel[y][x];
            }
        }
    }

    /**
     * Читает ядро из полей ввода
     */
    readKernelFromInputs() {
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                const value = parseFloat(this.kernelCells[y][x].value);
                this.kernel[y][x] = isNaN(value) ? 0 : value;
            }
        }
    }

    /**
     * Получает выбранные каналы
     */
    getSelectedChannels() {
        const channels = { red: false, green: false, blue: false, alpha: false };
        this.filterChannels.forEach(cb => {
            channels[cb.dataset.channel] = cb.checked;
        });
        return channels;
    }

    /**
     * Открывает диалоговое окно
     */
    open() {
        const imageData = this.app.ctx.getImageData(
            0, 0, this.app.canvas.width, this.app.canvas.height
        );
        this.originalImageData = imageData;

        // Загружаем пресет по умолчанию
        this.filterPreset.value = 'identity';
        this.loadPreset('identity');
        this.edgeMode.value = 'clamp';
        this.filterPreview.checked = true;

        this.dialog.showModal();
    }

    /**
     * Обновляет предпросмотр
     */
    updatePreview() {
        if (!this.originalImageData) return;

        const channels = this.getSelectedChannels();
        const edgeMode = this.edgeMode.value;

        const result = Convolution.apply(
            this.originalImageData,
            this.kernel,
            channels,
            edgeMode
        );

        this.app.ctx.putImageData(result, 0, 0);
    }

    /**
     * Восстанавливает оригинал
     */
    restoreOriginal() {
        if (!this.originalImageData) return;
        this.app.ctx.putImageData(this.originalImageData, 0, 0);
    }

    /**
     * Сбрасывает к тождественному отображению
     */
    reset() {
        this.filterPreset.value = 'identity';
        this.loadPreset('identity');
        this.edgeMode.value = 'clamp';
        if (this.filterPreview.checked) this.updatePreview();
    }

    /**
     * Применяет изменения
     */
    apply() {
        this.readKernelFromInputs();
        this.updatePreview();
        this.dialog.close();
        this.app.showNotification('Фильтр применён', 'success');
    }

    /**
     * Отменяет изменения
     */
    cancel() {
        this.restoreOriginal();
        this.dialog.close();
    }
}