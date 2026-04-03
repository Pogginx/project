import { _decorator, Component, Node, Label, warn } from 'cc';
import { EcologyManager } from './EcologyManager';
import { GasType, CreatureType, EcologyConstants } from './EcologyData';
const { ccclass, property } = _decorator;

@ccclass('EcologyMonitorPanel')
export class EcologyMonitorPanel extends Component {
    // 环境基础监控
    @property(Label) labTemperature: Label = null!;
    @property(Label) labHumidity: Label = null!;

    // 气体监控（数值标签）
    @property(Label) labO2Value: Label = null!;
    @property(Label) labCO2Value: Label = null!;

    // 生物占比监控
    @property(Label) labProducerRatio: Label = null!;
    @property(Label) labConsumerRatio: Label = null!;
    @property(Label) labDecomposerRatio: Label = null!;

    //季节和昼夜显示标签
    @property(Label) labSeason: Label = null!;
    @property(Label) labDayNight: Label = null!;

    private ecologyManager: EcologyManager | null = null;
    // 防止重复打印日志，减少控制台干扰
    private hasWarnedManagerNull = false;

    onLoad() {
        // 延迟1帧获取单例，避免EcologyManager还未初始化
        this.scheduleOnce(() => {
            this.initEcologyManager();
            this.initPanelData(); // 显示初始值
        }, 0);
    }

    /**
     * 初始化生态管理器，增加容错和日志
     */
    private initEcologyManager() {
        if (EcologyManager && EcologyManager.instance) {
            this.ecologyManager = EcologyManager.instance;
        } else {
            warn('[EcologyMonitor] 未找到EcologyManager单例，请检查EcologyManager是否正确挂载并初始化');
            this.hasWarnedManagerNull = true;
        }
    }

    /**
     * 引擎每帧自动调用，实现实时更新
     */
    update(dt: number) {
        // 每帧检查管理器是否存在，避免初始化失败后一直无响应
        if (!this.ecologyManager) {
            if (!this.hasWarnedManagerNull) {
                warn('[EcologyMonitor] EcologyManager实例为空，无法更新面板');
                this.hasWarnedManagerNull = true;
            }
            return;
        }

        this.updatePanel(dt);
    }

    private initPanelData() {
        const initEnv = EcologyConstants.INIT_ENV_DATA;
        if (!initEnv) {
            warn('[EcologyMonitor] 未找到初始环境数据，请检查EcologyConstants');
            return;
        }
        // 初始化UI显示
        this.labTemperature.string = `${initEnv.temperature.toFixed(1)}°C`;
        this.labHumidity.string = `${initEnv.humidity.toFixed(1)}%`;
        this.updateGasView(GasType.O2, initEnv.gas[GasType.O2]);
        this.updateGasView(GasType.CO2, initEnv.gas[GasType.CO2]);
        this.labProducerRatio.string = '0.00%';
        this.labConsumerRatio.string = '0.00%';
        this.labDecomposerRatio.string = '0.00%';


         // 初始化季节和昼夜（如果管理器还未就绪则显示默认）
        if (this.ecologyManager) {
            this.updateSeasonAndDay();
        } else {
            this.labSeason.string = '--';
            this.labDayNight.string = '--';
        }
    }

    private updatePanel(deltaTime: number) {
        try {
            // 获取实时生态数据
            const ecologyData = this.ecologyManager.getCurrentEcologyData();
            if (!ecologyData) {
                warn('[EcologyMonitor] getCurrentEcologyData返回空数据');
                return;
            }

            const envData = ecologyData.envData;
            const creatureRatio = ecologyData.creatureRatio;

            // 1. 更新环境数据
            if (envData) {
                this.labTemperature.string = `${envData.temperature.toFixed(1)}°C`;
                this.labHumidity.string = `${envData.humidity.toFixed(1)}%`;
            }

            // 2. 更新气体数据（仅显示数值，无上限）
            if (envData && envData.gas) {
                this.updateGasView(GasType.O2, envData.gas[GasType.O2]);
                this.updateGasView(GasType.CO2, envData.gas[GasType.CO2]);
            }

            // 3. 更新生物占比（保留2位小数）
            if (creatureRatio) {
                const producer = (creatureRatio[CreatureType.PRODUCER] || 0).toFixed(2);
                const consumer = (creatureRatio[CreatureType.CONSUMER] || 0).toFixed(2);
                const decomposer = (creatureRatio[CreatureType.DECOMPOSER] || 0).toFixed(2);

                this.labProducerRatio.string = `${producer}%`;
                this.labConsumerRatio.string = `${consumer}%`;
                this.labDecomposerRatio.string = `${decomposer}%`;
            }
            //更新季节和昼夜
            this.updateSeasonAndDay();
        } catch (error) {
            warn('[EcologyMonitor] 更新面板时出错:', error);
        }
    }

    //更新季节和昼夜显示
    private updateSeasonAndDay() {
        if (!this.ecologyManager) return;

        // 获取当前季节（英文字符串，可转换为中文）
        const seasonEn = this.ecologyManager.currentSeason; // 'SPRING', 'SUMMER', 'AUTUMN', 'WINTER'
        let seasonCn = '--';
        switch (seasonEn) {
            case 'SPRING': seasonCn = '春'; break;
            case 'SUMMER': seasonCn = '夏'; break;
            case 'AUTUMN': seasonCn = '秋'; break;
            case 'WINTER': seasonCn = '冬'; break;
        }
        this.labSeason.string = seasonCn;

        // 昼夜：白天/夜晚
        const isDay = this.ecologyManager.isDay;
        this.labDayNight.string = isDay ? '白天' : '夜晚';
    }

    private updateGasView(gasType: GasType, value: number) {
        const intValue = Math.floor(Number(value) || 0); // 兼容value为undefined/null的情况

        if (gasType === GasType.O2) {
            this.labO2Value.string = `${intValue} ppm`;
        } else {
            this.labCO2Value.string = `${intValue} ppm`;
        }
    }
}


