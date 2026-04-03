import { _decorator } from 'cc';
const { ccclass, property } = _decorator;

export enum InterventionType { 
    RAIN = "RAIN", 
    SNOW = "SNOW", 
    ADD_CO2 = "ADD_CO2", 
    CLEAN = "CLEAN",
    RET = "RET"  
};

export enum GasType { 
    O2 = "O2", 
    CO2 = "CO2" 
};

export enum CreatureType { 
    PRODUCER = "PRODUCER",    
    CONSUMER = "CONSUMER",    
    DECOMPOSER = "DECOMPOSER" 
};

export const MapConfig = { 
    MAP_SIZE: 3000,
    CANVAS_HEIGHT:1280,
    CANVAS_WIDTH:720,     
    ANIMAL_SIZE: 50,    
    PLANT_SIZE: 30      
};

export const ButtonType = { 
    WAIT_TIME: 2      
};

export interface InterventionEffect { 
    temperature?: number; 
    humidity?: number; 
    gas?: { [GasType.O2]?: number; [GasType.CO2]?: number; }; 
};

export const EcologyConstants = {
    INIT_ENV_DATA: { 
        temperature: 25.0, 
        humidity: 60.0, 
        gas: { [GasType.O2]: 18000, [GasType.CO2]: 800 } 
    },

    INTERVENTION_EFFECT: {
        [InterventionType.RAIN]: { temperature: -1, humidity: 4, gas: { [GasType.CO2]: 30 } } as InterventionEffect,
        [InterventionType.SNOW]: { temperature: -5, humidity: 3, gas: { [GasType.CO2]: 10 } } as InterventionEffect,
        [InterventionType.ADD_CO2]: { gas: { [GasType.CO2]: 300, [GasType.O2]: -200 } } as InterventionEffect,
        [InterventionType.CLEAN]: { gas: { [GasType.CO2]: 100, [GasType.O2]: -50 } } as InterventionEffect
    },

    CREATURE_DEFAULT: {
        [CreatureType.PRODUCER]: {                     
            hp: 80,                               
            resourceOutput: { [GasType.O2]: 0.12, [GasType.CO2]: -0.1 }
        },
        [CreatureType.CONSUMER]: {                         
            hp: 100,                              
            resourceOutput: { [GasType.O2]: -0.15, [GasType.CO2]: 0.25 }
        },
        [CreatureType.DECOMPOSER]: {                          
            hp: 60,                               
            resourceOutput: { [GasType.O2]: 0, [GasType.CO2]: 0 }   
        }
    },

    CORPSE_DECAY_TIME: 45,

    METABOLISM: {
        BASE_O2_CONSUME: -1.5,          
        BASE_CO2_PRODUCE: 2.5,          
        MOVE_O2_CONSUME: -0.5,          
        MOVE_CO2_PRODUCE: 0.8,          
        MOVE_HP_COST: 0.05,           
        EAT_BUFF_DURATION: 8,         
        EAT_BUFF_MULTIPLIER: 1.3,     
        CONSUMER_BASE_HP_COST: 2,
        PRODUCER_BASE_HP_COST: 2,
        SPLIT_CONSUMER_BASE_HP_COST: 6,
    },

    PLANT_WATER_CONSUME: 0.02,
    PLANT_CO2_CONSUME: 0.15,
    PLANT_O2_PRODUCE: 0.25,

    ENV_NATURAL_CHANGE: {
        O2_NATURAL_LOSS: 0.02,
        CO2_NATURAL_ADD: 0.01,
        HUMIDITY_NATURAL_LOSS: 0.01,
        HUMIDITY_NATURAL_ADD: 0.006
    },

    GAS_THRESHOLD: {
        [CreatureType.CONSUMER]: { type: GasType.O2, critical: 10000, damagePerSec: 2 },
        [CreatureType.PRODUCER]: { type: GasType.CO2, critical: 200, damagePerSec: 1.5 },
        [CreatureType.DECOMPOSER]: { type: null, critical: 0, damagePerSec: 0 }
    },

    // ========== 时间系统配置 ==========
    TIME: {
        DAY_DURATION: 18,           // 一天多少游戏秒
        YEAR_DURATION: 120,          // 一年多少游戏秒（即 6 天）
        SEASONS: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const,
    },

    // ========== 新增：季节温度范围（每个季节独立的最小/最大/目标温度） ==========
    SEASON_TEMP_RANGE: {
        SPRING: { min: 15, max: 25, target: 20 },
        SUMMER: { min: 25, max: 35, target: 30 },
        AUTUMN: { min: 10, max: 20, target: 15 },
        WINTER: { min: 0, max: 10, target: 5 },
    },

    // 温度调整速率（每秒向目标靠近的度数）
    SEASON_TEMP_ADJUST_RATE: 0.05,

    // 季节影响系数（繁殖、分解、活动消耗等保持不变）
    SEASON_EFFECT: {
        SPRING: {
            reproductionRate: 1.3,
            decomposeSpeed: 1.0,
            activityCost: 1.0,
        },
        SUMMER: {
            reproductionRate: 1.2,
            decomposeSpeed: 1.3,
            activityCost: 1.2,
        },
        AUTUMN: {
            reproductionRate: 0.8,
            decomposeSpeed: 0.8,
            activityCost: 1.1,
        },
        WINTER: {
            reproductionRate: 0.3,
            decomposeSpeed: 0.5,
            activityCost: 1.5,
        },
    },

    // 昼夜影响
    DAY_NIGHT_EFFECT: {
        DAY_LIGHT_FACTOR: 1.0,
        NIGHT_LIGHT_FACTOR: 0.2,
    },
};