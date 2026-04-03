import { _decorator, Component, instantiate, Node, Prefab, Vec3, math, Button, Label, Color, tween } from 'cc';
import { MapConfig, ButtonType, InterventionType } from './EcologyData';
import { EcologyManager } from './EcologyManager';  // 导入生态管理器

const { ccclass, property } = _decorator;

@ccclass('InterventionPanel')
export class InterventionPanel extends Component {

    //canvas节点
    @property(Node) Camera: Node = null;

    @property(Label)
    aiSuggestionLabel: Label = null!;



    //雨滴预制体
    @property(Prefab) rain: Prefab = null;
    //雨滴父节点
    @property(Node) parentRainNode: Node = null;
    //人工降雨按钮
    @property(Button) rainButton: Button = null;


    //雪预制体
    @property(Prefab) snow: Prefab = null;
    //雪父节点
    @property(Node) parentSnowNode: Node = null;
    //人工降雪按钮
    @property(Button) snowButton: Button = null;

    //co2预制体
    @property(Prefab) co2: Prefab = null;
    //co2父节点
    @property(Node) parentCo2Node: Node = null;
    //增加co2按钮
    @property(Button) co2Button: Button = null;


    private cameraNode :Node = null;

    private suggestionTween: any = null; // 存储当前动画
    onLoad() {
        // 获取摄像机节点
        this.cameraNode = this.Camera;
    }

    //生成雨滴
    public createRain() {
        if (!this.rain || !this.parentRainNode) {
            console.warn('[InterventionPanel] rain 预制体或 parentRainNode 未设置');
            return;
        }
        // 1. 清空父节点
        this.parentRainNode.removeAllChildren();

        // 2. 触发生态干预：降雨增加湿度
        const manager = EcologyManager.instance;
        if (manager) {
            manager.doIntervention(InterventionType.RAIN);
            console.log('[InterventionPanel] 降雨干预已触发，湿度增加');
        } else {
            console.warn('[InterventionPanel] 未找到 EcologyManager 实例');
        }

        // 3. 生成雨滴特效
        const rainCount = math.randomRangeInt(300, 501);
        for (let i = 0; i < rainCount; i++) {
            this.spawnRainDrop();
        }

        // 4. 按钮冷却（2秒内不可再点）
        if (this.rainButton) {
            this.rainButton.interactable = false;
        }
        this.scheduleOnce(() => {
            if (this.rainButton && this.rainButton.isValid) {
                this.rainButton.interactable = true;
            }
        }, ButtonType.WAIT_TIME);  // ButtonType.WaitTime 定义为 2
    }
    //实例化
    private spawnRainDrop() {
        const rainInstance = instantiate(this.rain);
        const half = MapConfig.MAP_SIZE / 2;
        const pos = new Vec3(
            math.randomRange(-half, half),
            math.randomRange(-half, half),
            0
        );
        rainInstance.setPosition(pos);
        rainInstance.parent = this.parentRainNode;
    }

    //生成雪花
    public createSnow() {
        if (!this.snow || !this.parentSnowNode) {
            console.warn('[InterventionPanel] snow 预制体或 parentSnowNode 未设置');
            return;
        }
        // 1. 清空父节点
        this.parentSnowNode.removeAllChildren();

        // 2. 触发生态干预：降雨增加湿度
        const manager = EcologyManager.instance;
        if (manager) {
            manager.doIntervention(InterventionType.SNOW);
            console.log('[InterventionPanel] 降雪干预已触发，湿度增加，温度降低');
        } else {
            console.warn('[InterventionPanel] 未找到 EcologyManager 实例');
        }
    
        // 3.实例化
        if (this.cameraNode) {
            // 获取摄像机在世界坐标中的位置
            const cameraWorldPos = this.cameraNode.getWorldPosition();

            // 创建雪花实例
            const snowInstance = instantiate(this.snow);
            snowInstance.parent = this.parentSnowNode;

            // 将摄像机世界坐标转换为 parentSnowNode 的局部坐标
            const localPos = new Vec3();
            this.parentSnowNode.inverseTransformPoint(localPos, cameraWorldPos);
            
            snowInstance.setPosition(localPos.x, localPos.y, 0);
        }

        // 4. 按钮冷却（2秒内不可再点）
        if (this.snowButton) {
            this.snowButton.interactable = false;
        }
        this.scheduleOnce(() => {
            if (this.snowButton && this.snowButton.isValid) {
                this.snowButton.interactable = true;
            }
        }, ButtonType.WAIT_TIME);  // ButtonType.WaitTime 定义为 2
    }

    //生成雪花
    public createCo2() {
        // 1. 清空父节点
        this.parentCo2Node.removeAllChildren();

        // 2. 触发生态干预：降雨增加湿度
        const manager = EcologyManager.instance;
        if (manager) {
            manager.doIntervention(InterventionType.ADD_CO2);
        }
    
        // 3.实例化
        if (this.cameraNode) {
            // 获取摄像机在世界坐标中的位置
            const cameraWorldPos = this.cameraNode.getWorldPosition();

            // 创建cos实例
            const co2Instance = instantiate(this.co2);
            co2Instance.parent = this.parentCo2Node;

            // 将摄像机世界坐标转换为 parentSnowNode 的局部坐标
            const localPos = new Vec3();
            this.parentCo2Node.inverseTransformPoint(localPos, cameraWorldPos);
            
            co2Instance.setPosition(localPos.x + 200, localPos.y, 0);
        }
        

        

        // 4. 按钮冷却（2秒内不可再点）
        if (this.co2Button) {
            this.co2Button.interactable = false;
        }
        this.scheduleOnce(() => {
            if (this.co2Button && this.co2Button.isValid) {
                this.co2Button.interactable = true;
            }
        }, ButtonType.WAIT_TIME);  // ButtonType.WaitTime 定义为 2
    }


     //清除尸体干预
    public clean() {
        const manager = EcologyManager.instance;
        if (manager) {
            manager.doIntervention(InterventionType.CLEAN);
            console.log('[InterventionPanel] 清除尸体干预已触发');
        } else {
            console.warn('[InterventionPanel] 未找到 EcologyManager 实例');
        }
    }


   public showAISuggestion(text: string) {
    if (!this.aiSuggestionLabel) return;

    // 停止之前的动画
    if (this.suggestionTween) {
        this.suggestionTween.stop();
        this.suggestionTween = null;
    }

    // 获取标签节点
    const labelNode = this.aiSuggestionLabel.node;
    
    // 重置状态：显示、不透明、初始位置（记录初始位置以便动画后恢复）
    labelNode.active = true;
    this.aiSuggestionLabel.color = new Color(255, 0, 0, 255);
    
    // 记录初始位置（如果之前被移动过，先恢复）
    // 这里假设初始位置就是当前节点的位置，我们可以直接基于当前位置进行移动
    const startPos = labelNode.position.clone();
    
    // 设置文本
    this.aiSuggestionLabel.string = text;

    // 延迟 autoHideDelay 秒后开始动画消失
    this.scheduleOnce(() => {
        if (!this.aiSuggestionLabel || !this.aiSuggestionLabel.isValid) return;

        // 目标位置：向上移动 moveOffset
        const endPos = new Vec3(startPos.x, startPos.y + 50, startPos.z);
        
        // 创建两个子动画
        const colorTween = tween(this.aiSuggestionLabel)
            .to(1.5, { color: new Color(255, 0, 0, 0) });
        const posTween = tween(labelNode)
            .to(1.5, { position: endPos });
        // 使用 parallel 并行执行
        this.suggestionTween = tween(this.aiSuggestionLabel) // 随便选一个作为主tween
            .parallel(colorTween, posTween)
            .call(() => {
                // 动画完成后隐藏节点，并恢复位置和透明度
                labelNode.active = false;
                labelNode.position = startPos;               // 恢复位置
                this.aiSuggestionLabel.color = new Color(255, 0, 0, 255); // 恢复不透明
                this.suggestionTween = null;
            })
            .start();
    });
}
}