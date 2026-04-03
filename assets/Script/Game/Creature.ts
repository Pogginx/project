import { _decorator, Component, Node, CCInteger, Collider2D, Sprite, Vec3, math, BoxCollider2D, Contact2DType, IPhysics2DContact } from 'cc';
import { EcologyManager } from './EcologyManager';
import { CreatureType,EcologyConstants} from './EcologyData';
const { ccclass, property } = _decorator;

@ccclass('Creature')
export class Creature extends Component {
    @property({ type: CCInteger, tooltip: "生命值" })
    hp: number = 100;

    @property({ type: CreatureType, tooltip: "生物类型" })
    creatureType: CreatureType = CreatureType.CONSUMER;

    public dataId: string = "";
    public isDead: boolean = false;

    private sprite: Sprite = null;
    private _collisionListenerBound: boolean = false;

    onLoad() {
        this.refreshSprites();
        this.bindCollisionEvent();
    }

    onEnable() {
        this.refreshSprites();
        this.bindCollisionEvent();
    }

    onDisable() {
        this.unbindCollisionEvent();
    }

    private refreshSprites() {
        this.sprite = this.getComponent(Sprite);
    }

    private bindCollisionEvent() {
        if (this._collisionListenerBound) return;

        const collider = this.getComponent(BoxCollider2D);
        if (collider && collider.isValid) {
            collider.sensor = false;
            collider.enabled = true;

            if (Collider2D) {
                collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
                this._collisionListenerBound = true;
            }
        }
    }

    private unbindCollisionEvent() {
        if (!this._collisionListenerBound) return;

        const collider = this.getComponent(BoxCollider2D);
        if (collider && collider.isValid) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this._collisionListenerBound = false;
        }
    }

    update(deltaTime: number) {
        if (this.isDead) return;
    }

    /** 
     * 设置 Sprite 透明度
     * @param alpha 0.0 ~ 1.0
     */
    public setSpritesAlpha(alpha: number) {
        if (!this.sprite) {
            this.refreshSprites();
            if (!this.sprite) {
                console.warn(`[Creature] setSpritesAlpha failed: sprite is null on node ${this.node.name}`);
                return;
            }
        }
        const color = this.sprite.color.clone();
        color.a = alpha;
        this.sprite.color = color;
    }

    /**
     * 将当前生物设为尸体状态（半透明）
     */
    public setCorpseAlpha() {
        this.setSpritesAlpha(55); // 半透明，可根据需要调整
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (this.isDead) return;
        if (!this.node || !otherCollider || !otherCollider.node || !otherCollider.node.isValid) return;
        if (!this.isValid) return;
        if (!otherCollider.node.isValid) return;

        const otherCreature = otherCollider.node.getComponent(Creature);
        if (!otherCreature) return;

        // 分解者碰到尸体：立即分解
        if (this.creatureType === CreatureType.DECOMPOSER && otherCreature.isDead) {
            this.handleDecomposeCorpse(otherCreature);
            return;
        }

        // 其他碰撞只处理活着的生物
        if (otherCreature.isDead) return;

        // 捕食逻辑：消费者（动物）碰到生产者（植物）
        if (this.creatureType === CreatureType.CONSUMER && otherCreature.creatureType === CreatureType.PRODUCER) {
            this.handleEatPlant(otherCreature);
        }
    }

    private handleDecomposeCorpse(corpse: Creature) {
        const manager = EcologyManager.instance;
        if (!manager) return;
        
        // 延迟一帧执行分解，避免在碰撞回调中直接销毁节点
        setTimeout(() => {
            try {
                if (!corpse || !corpse.node || !corpse.node.isValid) return;
                manager.decomposeCorpse(corpse.dataId);
                // 可选：增加分解者的分解计数或其他逻辑（如有需求可在此扩展）
            } catch (error) {
                console.error('分解尸体失败:', error);
            }
        }, 0);
    }

    private handleEatPlant(plant: Creature) {
        if (!this.isValid || !plant.node || !plant.node.isValid) return;

        const manager = EcologyManager.instance;
        if (!manager) return;

        const predatorData = manager.getCreatureData(this.dataId);
        const preyData = manager.getCreatureData(plant.dataId);

        if (!predatorData || !predatorData.isAlive || !preyData || !preyData.isAlive) return;

        try {
            manager.removeCreature(plant.dataId);
        } catch (error) {
            console.error('移除植物失败:', error);
            return;
        }

        predatorData.eatenPlantCount += 1;

        if (predatorData.eatenPlantCount >= 4 && !predatorData.hasSplit) {
            setTimeout(() => {
                try {
                    if (!this.isValid || !this.node) return;
                    const spawnPos = this.node.position.clone().add(new Vec3(
                        math.randomRange(-50, 50),
                        math.randomRange(-50, 50),
                        0
                    ));
                    manager.spawnSpecificCreature(CreatureType.CONSUMER, predatorData.prefabIndex, spawnPos);
                    predatorData.hasSplit = true;
                    predatorData.eatenPlantCount = 0;
                } catch (error) {
                    console.error('生成新动物失败:', error);
                }
            }, 0);
        }
    }
}


