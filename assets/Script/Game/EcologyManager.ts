import { _decorator, Component, Node, Prefab, instantiate, NodePool, Vec3, math } from 'cc';
import { Creature } from './Creature';
import { Move } from './Move';
import { AiManager } from './AiManager';
import { InterventionPanel } from './InterventionPanel';
import { InterventionType, GasType, CreatureType, MapConfig, EcologyConstants, InterventionEffect } from './EcologyData';

const { ccclass, property } = _decorator;

namespace Utils {
    export function objectEntries(obj: any): [string, any][] {
        const entries: [string, any][] = [];
        for (const key in obj) if (obj.hasOwnProperty(key)) entries.push([key, obj[key]]);
        return entries;
    }
    export function randomPick<T>(arr: T[]): T | null {
        return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    }
    export function getRandomMapPosition(isAnimal: boolean): Vec3 {
        const halfSize = isAnimal ? MapConfig.ANIMAL_SIZE / 2 : MapConfig.PLANT_SIZE / 2;
        const mapHalf = MapConfig.MAP_SIZE / 2;
        const min = -mapHalf + halfSize;
        const max = mapHalf - halfSize;
        return new Vec3(math.randomRange(min, max), math.randomRange(min, max), 0);
    }
    export function getFloatingValue(baseValue: number, floatRate: number = 0.3): number {
        const randomRatio = 1 - floatRate + Math.random() * 2 * floatRate;
        const result = baseValue * randomRatio;
        return Math.max(0, result);
    }
}

interface CreatureData {
    id: string;
    type: CreatureType;
    hp: number;
    isAlive: boolean;
    isGrown?: boolean;
    isCorpse?: boolean;
    corpseTimer?: number;
    resourceOutput: { [key in GasType]: number };
    prefabIndex: number;
    node: Node;
    buffRemainingTime?: number;
    buffMultiplier?: number;
    eatenPlantCount: number;
    splitTimer?: number;
    hasSplit?: boolean;
    lastEatTime: number;
}

// ========== CreatureSystem 内部类（无大变化，仅保留） ==========
class CreatureSystem {
    // 管理所有生物数据，提供创建、更新、分解等功能 
    public allCreatures: CreatureData[] = [];
    // 通过类型和预制体索引创建生物数据，并添加到系统中
    private nextId = 1;

    createCreature(type: CreatureType, prefabIndex: number): CreatureData {
        //  根据类型获取默认属性，应用随机浮动，创建生物数据对象并添加到系统中
        const def = EcologyConstants.CREATURE_DEFAULT[type] || {
            hp: 0, resourceOutput: { [GasType.O2]: 0, [GasType.CO2]: 0 }
        };
        //  资源输出增加随机浮动，避免每个生物完全相同
        const baseOutput = def.resourceOutput || { [GasType.O2]: 0, [GasType.CO2]: 0 };
        //  生成带有随机浮动的资源输出，增加生态系统的动态性和不可预测性
        const floatingOutput: { [key in GasType]: number } = {
            [GasType.O2]: Utils.getFloatingValue(baseOutput[GasType.O2]),
            [GasType.CO2]: Utils.getFloatingValue(baseOutput[GasType.CO2])
        };
        //  创建生物数据对象，包含唯一ID、类型、HP、资源输出、预制体索引等信息，并添加到系统的生物列表中
        const creature: CreatureData = {
            id: `creature_${this.nextId++}`,
            type,
            hp: def.hp,
            isAlive: true,
            isGrown: type !== CreatureType.PRODUCER,
            resourceOutput: floatingOutput,
            prefabIndex,
            node: null!,
            buffRemainingTime: 0,
            buffMultiplier: 1,
            eatenPlantCount: 0,
            splitTimer: 0,
            hasSplit: false,
            lastEatTime: EcologyManager.instance.gameTime
        };
        this.allCreatures.push(creature);
        return creature;
    }
    // 更新所有生物状态，处理生物的自然衰减、植物分裂等逻辑，传递季节相关的繁殖率和活动成本
    updateAllCreatures(deltaTime: number, envGas: { [key in GasType]: number }, manager: any,reproductionRate: number, activityCost: number) {
        // 遍历所有生物，更新其状态。对于每个生物，根据其类型和当前环境状态计算HP变化、资源输出等，并处理植物分裂逻辑
        this.allCreatures.forEach(c => {
            if (!c.isAlive) return;

            // 增益计时器
            if (c.buffRemainingTime && c.buffRemainingTime > 0) {
                c.buffRemainingTime -= deltaTime;
                if (c.buffRemainingTime <= 0) {
                    c.buffRemainingTime = 0;
                    c.buffMultiplier = 1;
                }
            }

            // 基础 HP 消耗（受季节活动成本影响）
            if (c.type === CreatureType.CONSUMER) {
                // 消费者的基础HP消耗根据是否分裂过有所不同，分裂过的消费者由于需要更多能量维持更大的体型，基础HP消耗更高
                const baseHPCost = c.hasSplit
                    ? EcologyConstants.METABOLISM.SPLIT_CONSUMER_BASE_HP_COST
                    : EcologyConstants.METABOLISM.CONSUMER_BASE_HP_COST;
                c.hp -= baseHPCost * deltaTime * activityCost;
            } else if (c.type === CreatureType.PRODUCER) {
                c.hp -= EcologyConstants.METABOLISM.PRODUCER_BASE_HP_COST * deltaTime;
            }

            if (c.hp <= 0) this.turnToCorpse(c);

            // 植物分裂（繁殖）逻辑，受季节繁殖率影响
            if (c.type === CreatureType.PRODUCER && c.isAlive) {
                //  分裂计时器增加，达到分裂时间后触发分裂，生成新的植物生物，并重置计时器。分裂时间受季节繁殖率影响，繁殖率越高，分裂越快
                c.splitTimer = (c.splitTimer || 0) + deltaTime * reproductionRate;
                if (c.splitTimer >= 15) {
                    const prefabIndex = c.prefabIndex;
                    const spawnPos = c.node.position.clone().add(new Vec3(
                        math.randomRange(-200, 200),
                        math.randomRange(-200, 200),
                        0
                    ));
                    const plantId = c.id;
                    // 使用 setTimeout 将分裂逻辑放入下一帧执行，确保当前帧的更新逻辑完成后再进行分裂，避免在同一帧内对生物列表进行修改导致的潜在问题
                    setTimeout(() => {
                        try {
                            EcologyManager.instance.spawnSpecificCreature(CreatureType.PRODUCER, prefabIndex, spawnPos);
                            const currentCreature = EcologyManager.instance.getCreatureData(plantId);
                            if (currentCreature) {
                                currentCreature.splitTimer = 0;
                            }
                        } catch (error) {
                            console.error('植物分裂失败:', error);
                        }
                    }, 0);
                }
            }
        });
    }

    //  将生物标记为尸体，更新其状态并禁用相关组件
    turnToCorpse(c: CreatureData) {
        c.isAlive = false;
        c.isCorpse = true;
        c.corpseTimer = 0;
        c.buffRemainingTime = 0;
        c.buffMultiplier = 1;

        if (c.type === CreatureType.CONSUMER) {
            if (c.node) {
                const moveComp = c.node.getComponent(Move);
                if (moveComp) moveComp.enabled = false;
            }
        }
        const creatureComp = c.node.getComponent(Creature);
        if (creatureComp) {
            creatureComp.isDead = true;
            creatureComp.hp = 0;
            creatureComp.setCorpseAlpha();
        }
    }

    //  分解尸体，返回分解产生的气体资源，并从系统中移除该生物数据
    decomposeCorpse(c: CreatureData): { [key in GasType]: number } {
        //co2增量
        let baseCO2 = 0;
        
        if (c.type === CreatureType.PRODUCER) baseCO2 = 3;
        else if (c.type === CreatureType.CONSUMER) baseCO2 = 8;
        else baseCO2 = 0;
        // 生成带有随机浮动的CO2产出，增加生态系统的动态性和不可预测性
        const co2Value = Utils.getFloatingValue(baseCO2, 0.3);
        // 创建分解产出对象，包含不同类型的气体资源增量，目前仅有CO2，O2为0
        const output: { [key in GasType]: number } = { [GasType.O2]: 0, [GasType.CO2]: co2Value };
        // 从系统中移除该生物数据，并销毁其节点，清理相关资源
        const idx = this.allCreatures.findIndex(cr => cr.id === c.id);
        if (idx !== -1) this.allCreatures.splice(idx, 1);
        if (c.node) c.node.destroy();
        return output;
    }

    //  更新尸体状态，处理尸体的分解逻辑
    updateCorpses(deltaTime: number, decomposeSpeed: number): { [key in GasType]: number }[] {
        const outputs: { [key in GasType]: number }[] = [];
        this.allCreatures.forEach(c => {
            if (c.isCorpse) {
                c.corpseTimer! += deltaTime * decomposeSpeed;
                if (c.corpseTimer! >= EcologyConstants.CORPSE_DECAY_TIME) {
                    outputs.push(this.decomposeCorpse(c));
                }
            }
        });
        return outputs;
    }

    // 获取当前生物占比，包含生产者、消费者、分解者的占比百分比
    getCreatureRatio() {
        const alive = this.allCreatures.filter(c => c.isAlive).length;
        if (alive === 0) return {};
        const ratio: any = {};
        // 计算每种类型的生物数量占比，并返回一个对象
        [CreatureType.PRODUCER, CreatureType.CONSUMER, CreatureType.DECOMPOSER].forEach(t => {
            const cnt = this.allCreatures.filter(c => c.isAlive && c.type === t).length;
            ratio[t] = (cnt / alive) * 100;
        });
        return ratio;
    }

    // 根据ID获取生物数据对象
    getCorpses() {
        return this.allCreatures.filter(c => c.isCorpse);
    }

    // 根据ID获取生物数据对象
    getCreatureById(id: string) {
        // 通过ID查找生物数据对象，返回找到的对象或null
        return this.allCreatures.find(c => c.id === id);
    }

    // 通过ID查找生物数据对象，并将其标记为已成长，更新相关状态
    markAsGrown(id: string) {
        const c = this.getCreatureById(id);
        if (c && c.type === CreatureType.PRODUCER) c.isGrown = true;
    }

    // 从系统中移除生物数据对象，并销毁其节点，清理相关资源
    removeCreature(id: string) {
        const idx = this.allCreatures.findIndex(c => c.id === id);
        if (idx !== -1) {
            const c = this.allCreatures[idx];
            if (c.node) c.node.destroy();
            this.allCreatures.splice(idx, 1);
        }
    }
}

//创建生物节点的对象池类
class CreaturePool {
    // 管理生物节点的对象池
    private animalPools: { [type in CreatureType]?: NodePool[] } = { [CreatureType.CONSUMER]: [], [CreatureType.DECOMPOSER]: [] };
    private plantPools: NodePool[] = [];
    // 构造函数，根据预设的动物和植物预制体数量初始化对象池
    constructor(animalPrefabCount: number, plantPrefabCount: number) {
        Object.keys(this.animalPools).forEach(t => {
            const type = t as CreatureType;
            this.animalPools[type] = [];
            for (let i = 0; i < animalPrefabCount; i++) this.animalPools[type]!.push(new NodePool());
        });
        for (let i = 0; i < plantPrefabCount; i++) this.plantPools.push(new NodePool());
    }

    // 根据生物类型和预制体索引获取一个节点，优先从对象池中获取，如果对象池中没有可用节点，则实例化一个新的节点，并设置其初始状态
    getCreatureNode(type: CreatureType, prefab: Prefab, idx: number): Node {
        if (type === CreatureType.PRODUCER) {
            if (this.plantPools.length <= idx) return instantiate(prefab);
            const pool = this.plantPools[idx];
            // 获取对象池的一个节点
            let node = pool.get();
            // 如果对象池中没有可用节点，则实例化一个新的节点
            if (!node) node = instantiate(prefab);
            node.active = true;
            node.position = new Vec3(0, 0, 0);
            return node;
        } else {
            if (!this.animalPools[type] || this.animalPools[type]!.length <= idx) return instantiate(prefab);
            const pool = this.animalPools[type]![idx];
            let node = pool.get();
            if (!node) node = instantiate(prefab);
            node.active = true;
            node.position = new Vec3(0, 0, 0);
            return node;
        }
    }
}

@ccclass('EcologyManager')
export class EcologyManager extends Component {
    //单例模式，方便全局访问生态管理器实例
    private static _instance: EcologyManager | null = null;
    // 获取生态管理器实例，如果实例未初始化则抛出错误，确保在使用前已经正确初始化
    public static get instance(): EcologyManager {
        if (!this._instance) throw new Error("EcologyManager not initialized");
        return this._instance;
    }

    //获取AI节点
    @property(AiManager)
    aiManager: AiManager = null;

    //获取干预面板节点
    @property(Node)
    InterventionPanelNode: Node = null;

    //动物父节点
    @property(Node) creatureAnimalNode: Node = null!;
    //植物父节点
    @property(Node) creaturePlantNode: Node = null!;
    //分解者父节点
    @property(Node) creatureDecomposerNode: Node = null!;
    //预制体数组，包含不同类型和变体的动物、植物和分解者预制体
    @property([Prefab]) animalPrefab: Prefab[] = [];
    @property([Prefab]) plantPrefab: Prefab[] = [];
    @property([Prefab]) decomposerPrefab: Prefab[] = [];
    // 生态资源更新间隔，单位为秒，控制环境资源（如气体和湿度）的更新频率
    @property resourceUpdateInterval: number = 0.5;

    //
    public envData = JSON.parse(JSON.stringify(EcologyConstants.INIT_ENV_DATA));
    public creatureSystem = new CreatureSystem();
    private creaturePool!: CreaturePool;
    private resourceTimer = 0;
    public gameTime: number = 0;

    private aiTimer = 0;
    private aiInterval = 10;

    // 时间系统属性
    private dayTime: number = 0;
    private yearTime: number = 0;
    public currentSeason: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER' = 'SPRING';
    public isDay: boolean = true;
    public lightFactor: number = 1.0;

    onLoad() {
        EcologyManager._instance = this;
        this.initCreatureRootNodes();
        this.creaturePool = new CreaturePool(this.animalPrefab.length, this.plantPrefab.length);
        this.initEcosystem();
        this.resetTime();
    }

    onDestroy() {
        if (EcologyManager._instance === this) EcologyManager._instance = null;
    }

    private resetTime() {
        this.dayTime = 0;
        this.yearTime = 0;
        this.updateSeasonAndDay();
    }

    update(deltaTime: number) {
        this.gameTime += deltaTime;

        // 更新时间
        this.dayTime += deltaTime;
        this.yearTime += deltaTime;
        const dayDur = EcologyConstants.TIME.DAY_DURATION;
        const yearDur = EcologyConstants.TIME.YEAR_DURATION;
        if (this.dayTime >= dayDur) this.dayTime -= dayDur;
        if (this.yearTime >= yearDur) this.yearTime -= yearDur;

        // 更新季节和昼夜
        this.updateSeasonAndDay();

        // 获取当前季节因子
        const season = this.currentSeason;
        const seasonEffect = EcologyConstants.SEASON_EFFECT[season];

        // 更新生物（传递季节因子）
        this.creatureSystem.updateAllCreatures(deltaTime, this.envData.gas, this,
            seasonEffect.reproductionRate, seasonEffect.activityCost);

        // 环境自然变化（包含季节温度范围调整）
        this.updateNaturalEnvChange(deltaTime);

        // 定期更新生态资源（应用光照因子，并包含随机温度波动）
        this.resourceTimer += deltaTime;
        if (this.resourceTimer >= this.resourceUpdateInterval) {
            this.updateEcologyResources();
            this.resourceTimer = 0;
        }

        // 尸体分解
        const decayOutputs = this.creatureSystem.updateCorpses(deltaTime, seasonEffect.decomposeSpeed);
        decayOutputs.forEach(o => Utils.objectEntries(o).forEach(([g, v]) => this.envData.gas[g as GasType] += v));

        // 限制气体和湿度范围（温度不再全局硬限制，由季节范围控制）
        this.limitEnvValues(deltaTime);

        // AI 决策
        this.aiTimer += deltaTime;
        if (this.aiTimer >= this.aiInterval) {
            this.aiTimer = 0;
            //this.requestAIDecision();
        }
    }

    private updateSeasonAndDay() {
        const halfDay = EcologyConstants.TIME.DAY_DURATION / 2;
        this.isDay = this.dayTime < halfDay;
        this.lightFactor = this.isDay
            ? EcologyConstants.DAY_NIGHT_EFFECT.DAY_LIGHT_FACTOR
            : EcologyConstants.DAY_NIGHT_EFFECT.NIGHT_LIGHT_FACTOR;

        const seasonCount = EcologyConstants.TIME.SEASONS.length;
        const seasonIndex = Math.floor((this.yearTime / EcologyConstants.TIME.YEAR_DURATION) * seasonCount);
        this.currentSeason = EcologyConstants.TIME.SEASONS[seasonIndex] as any;
    }

    // 修改：温度向季节目标调整，并钳位到季节范围
    private updateNaturalEnvChange(deltaTime: number) {
        const naturalConfig = EcologyConstants.ENV_NATURAL_CHANGE;

        // 气体和湿度的自然变化（保持不变）
        this.envData.gas[GasType.O2] -= naturalConfig.O2_NATURAL_LOSS * deltaTime;
        this.envData.gas[GasType.CO2] += naturalConfig.CO2_NATURAL_ADD * deltaTime;
        this.envData.humidity -= naturalConfig.HUMIDITY_NATURAL_LOSS * deltaTime;
        this.envData.humidity += naturalConfig.HUMIDITY_NATURAL_ADD * deltaTime;

        // 获取当前季节的温度范围
        const tempRange = EcologyConstants.SEASON_TEMP_RANGE[this.currentSeason];
        const targetTemp = tempRange.target;
        const adjustRate = EcologyConstants.SEASON_TEMP_ADJUST_RATE;

        // 向目标温度调整
        if (this.envData.temperature < targetTemp) {
            this.envData.temperature = Math.min(
                this.envData.temperature + adjustRate * deltaTime,
                targetTemp
            );
        } else if (this.envData.temperature > targetTemp) {
            this.envData.temperature = Math.max(
                this.envData.temperature - adjustRate * deltaTime,
                targetTemp
            );
        }

        // 最终钳位到季节允许的最小/最大范围（防止调整后超出）
        this.envData.temperature = Math.max(tempRange.min, Math.min(tempRange.max, this.envData.temperature));
    }

    // 修改：资源更新时增加随机波动，并立即钳位到季节范围
    private updateEcologyResources() {
        this.creatureSystem.allCreatures.forEach(c => {
            if (!c.isAlive) return;
            if (c.type === CreatureType.DECOMPOSER) return;

            let o2Change = Utils.getFloatingValue(c.resourceOutput[GasType.O2], 0.2);
            let co2Change = Utils.getFloatingValue(c.resourceOutput[GasType.CO2], 0.2);

            // 生产者受光照影响
            if (c.type === CreatureType.PRODUCER) {
                o2Change *= this.lightFactor;
            }

            if (c.type !== CreatureType.PRODUCER && c.buffMultiplier && c.buffMultiplier > 1) {
                o2Change *= c.buffMultiplier;
                co2Change *= c.buffMultiplier;
            }

            this.envData.gas[GasType.O2] += o2Change * this.resourceUpdateInterval;
            this.envData.gas[GasType.CO2] += co2Change * this.resourceUpdateInterval;
        });

        // 随机微小波动
        this.envData.temperature += (Math.random() - 0.5) * 0.2;
        this.envData.humidity += (Math.random() - 0.5) * 0.5;

        // 随机波动后，确保温度仍在当前季节范围内
        const tempRange = EcologyConstants.SEASON_TEMP_RANGE[this.currentSeason];
        this.envData.temperature = Math.max(tempRange.min, Math.min(tempRange.max, this.envData.temperature));
    }

    // 修改：只限制气体和湿度，温度不再在这里限制（已由季节控制）
    private limitEnvValues(deltaTime: number) {
        this.envData.gas[GasType.O2] = Math.max(15000, Math.min(25000, this.envData.gas[GasType.O2]));
        this.envData.gas[GasType.CO2] = Math.max(100, this.envData.gas[GasType.CO2]);
        this.envData.humidity = Math.max(10, Math.min(100, this.envData.humidity));
        // 温度不再全局限制
    }

    private initCreatureRootNodes() {
        if (!this.creatureAnimalNode) (this.creatureAnimalNode = new Node("CreatureAnimalRoot")).parent = this.node.scene;
        if (!this.creaturePlantNode) (this.creaturePlantNode = new Node("CreaturePlantRoot")).parent = this.node.scene;
        if (!this.creatureDecomposerNode) (this.creatureDecomposerNode = new Node("CreatureDecomposerRoot")).parent = this.node.scene;
    }

    public initEcosystem() {
        this.spawnCreatures(CreatureType.PRODUCER, 100);
        this.spawnCreatures(CreatureType.CONSUMER, 30);
        this.spawnCreatures(CreatureType.DECOMPOSER, 300);
    }

    public spawnCreatures(type: CreatureType, count: number) {
        for (let i = 0; i < count; i++) this.spawnSingleCreature(type, Utils.getRandomMapPosition(type !== CreatureType.PRODUCER));
    }

    public spawnSingleCreature(type: CreatureType, position: Vec3) {
        let prefabArray: Prefab[] = [];
        if (type === CreatureType.PRODUCER) prefabArray = this.plantPrefab;
        else if (type === CreatureType.DECOMPOSER) prefabArray = this.decomposerPrefab;
        else prefabArray = this.animalPrefab;
        const randomPrefab = Utils.randomPick(prefabArray);
        if (!randomPrefab) return;
        const prefabIndex = prefabArray.indexOf(randomPrefab);
        this.spawnSpecificCreature(type, prefabIndex, position);
    }

    public spawnSpecificCreature(type: CreatureType, prefabIndex: number, position: Vec3) {
        let prefabArray: Prefab[] = [];
        let parentNode: Node = this.creatureAnimalNode;
        if (type === CreatureType.PRODUCER) {
            prefabArray = this.plantPrefab;
            parentNode = this.creaturePlantNode;
        } else if (type === CreatureType.DECOMPOSER) {
            prefabArray = this.decomposerPrefab;
            parentNode = this.creatureDecomposerNode;
        } else {
            prefabArray = this.animalPrefab;
            parentNode = this.creatureAnimalNode;
        }

        if (prefabArray.length === 0) { console.error(`[生态管理器] ${type} 预制体数组为空`); return; }
        if (prefabIndex < 0 || prefabIndex >= prefabArray.length) { console.error(`[生态管理器] 预制体索引 ${prefabIndex} 超出范围`); return; }

        const halfSize = type !== CreatureType.PRODUCER ? MapConfig.ANIMAL_SIZE / 2 : MapConfig.PLANT_SIZE / 2;
        const mapBoundary = MapConfig.MAP_SIZE / 2 - halfSize;
        position.x = math.clamp(position.x, -mapBoundary, mapBoundary);
        position.y = math.clamp(position.y, -mapBoundary, mapBoundary);

        const prefab = prefabArray[prefabIndex];
        const creature = this.creatureSystem.createCreature(type, prefabIndex);
        const node = this.creaturePool.getCreatureNode(type, prefab, prefabIndex);

        node.name = `${type}_${creature.id}_${prefabIndex}`;
        node.parent = parentNode;
        node.active = true;
        node.setPosition(position);
        creature.node = node;

        let creatureComp = node.getComponent(Creature);
        if (!creatureComp) creatureComp = node.addComponent(Creature);
        creatureComp.dataId = creature.id;
        creatureComp.creatureType = type;
        creatureComp.hp = creature.hp;

        if (type !== CreatureType.PRODUCER && !node.getComponent(Move)) {
            node.addComponent(Move);
        }
    }

    public markAsCorpse(id: string) {
        const c = this.getCreatureData(id);
        if (c && c.isAlive) this.creatureSystem.turnToCorpse(c);
    }

    public markAsGrown(id: string) { this.creatureSystem.markAsGrown(id); }

    public removeCreature(id: string) { this.creatureSystem.removeCreature(id); }

    public decomposeCorpse(corpseId: string): boolean {
        const corpseData = this.creatureSystem.getCreatureById(corpseId);
        if (!corpseData || !corpseData.isCorpse) return false;
        const gasOutput = this.creatureSystem.decomposeCorpse(corpseData);
        Utils.objectEntries(gasOutput).forEach(([g, v]) => {
            this.envData.gas[g as GasType] += v;
        });
        return true;
    }

    public doIntervention(type: InterventionType) {
        const effect = EcologyConstants.INTERVENTION_EFFECT[type] as InterventionEffect;
        if (!effect) return;
        if (effect.temperature !== undefined) this.envData.temperature += effect.temperature;
        if (effect.humidity !== undefined) this.envData.humidity += effect.humidity;
        if (effect.gas) {
            Utils.objectEntries(effect.gas).forEach(([g, v]) => {
                const floatingV = Utils.getFloatingValue(v, 0.1);
                this.envData.gas[g as GasType] += floatingV;
            });
        }
        if (type === InterventionType.CLEAN) {
            this.creatureSystem.getCorpses().forEach(c => {
                const out = this.creatureSystem.decomposeCorpse(c);
                Utils.objectEntries(out).forEach(([g, v]) => this.envData.gas[g as GasType] += v);
            });
        }
        // 注意：干预后温度可能超出季节范围，但自然调节会慢慢拉回，此处不主动限制
    }

    public getCurrentEcologyData() {
        return {
            envData: JSON.parse(JSON.stringify(this.envData)),
            creatureRatio: this.creatureSystem.getCreatureRatio(),
            totalCreatures: this.creatureSystem.allCreatures.length,
            aliveCreatures: this.creatureSystem.allCreatures.filter(c => c.isAlive).length,
            corpseCount: this.creatureSystem.getCorpses().length,
            predatorCount: this.creatureSystem.allCreatures.filter(c => c.isAlive && c.type === CreatureType.CONSUMER).length,
            preyCount: this.creatureSystem.allCreatures.filter(c => c.isAlive && c.type === CreatureType.PRODUCER).length
        };
    }

    public getCreatureData(id: string) {
        return this.creatureSystem.getCreatureById(id);
    }

    private async requestAIDecision() {
        if (!this.aiManager) {
            console.warn('AIManager 未设置');
            return;
        }
        const ecologyData = this.getCurrentEcologyData();
        const result = await this.aiManager.requestIntervention(ecologyData);
        const panel = this.InterventionPanelNode.getComponent(InterventionPanel);
        if (!panel) {
            console.warn('InterventionPanel 未找到');
            return;
        }
        if (!result) {
            panel.showAISuggestion('AI 建议获取失败');
            return;
        }
        const { action, reason } = result;
        panel.showAISuggestion(reason || 'AI 未提供理由');
        if (!action) return;
        switch (action) {
            case 'RAIN':
                if (panel.rainButton?.interactable) panel.createRain();
                break;
            case 'SNOW':
                if (panel.snowButton?.interactable) panel.createSnow();
                break;
            case 'ADD_CO2':
                if (panel.co2Button?.interactable) panel.createCo2();
                break;
            case 'CLEAN':
                if (panel['clean']) panel['clean']();
                else console.warn('InterventionPanel 未实现 clean 方法');
                break;
            default:
                console.warn('未知干预类型:', action);
        }
    }
}