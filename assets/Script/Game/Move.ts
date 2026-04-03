import { _decorator, Component, Node, Vec3, math } from 'cc';
import { Creature } from './Creature';
import { MapConfig, CreatureType } from './EcologyData';
const { ccclass, property } = _decorator;

@ccclass('Move')
export class Move extends Component {
    @property({ tooltip: "移动速度（像素/秒）", min: 1, max: 200 })
    public moveSpeed: number = 50;

    @property({ tooltip: "随机转向间隔（秒）", min: 1, max: 10 })
    public randomDirInterval: number = 4;

    private mapBoundary: number = 0;
    private targetDir: Vec3 = new Vec3();
    private dirTimer: number = 0;
    private creatureComp: Creature | null = null;

    onLoad() {
        this.creatureComp = this.getComponent(Creature);
        const isAnimal = this.creatureComp ? this.creatureComp.creatureType !== CreatureType.PRODUCER : true;
        const halfSize = isAnimal ? MapConfig.ANIMAL_SIZE / 2 : MapConfig.PLANT_SIZE / 2;
        this.mapBoundary = MapConfig.MAP_SIZE / 2 - halfSize;

        this.node.eulerAngles = new Vec3(0, 0, 0);
        this.resetRandomDirection();
        this.updateRotationImmediately();
    }

    update(deltaTime: number) {
        this.dirTimer += deltaTime;
        if (this.dirTimer >= this.randomDirInterval) {
            this.resetRandomDirection();
            this.dirTimer = 0;
            this.updateRotationImmediately();
        }

        const moveStep = this.moveSpeed * deltaTime;
        const currentPos = this.node.position;
        const newPos = new Vec3(
            currentPos.x + this.targetDir.x * moveStep,
            currentPos.y + this.targetDir.y * moveStep,
            currentPos.z
        );

        const clampedPos = new Vec3(
            math.clamp(newPos.x, -this.mapBoundary, this.mapBoundary),
            math.clamp(newPos.y, -this.mapBoundary, this.mapBoundary),
            newPos.z
        );
        let isRebound = false;
        if (clampedPos.x !== newPos.x) { this.targetDir.x *= -1; isRebound = true; }
        if (clampedPos.y !== newPos.y) { this.targetDir.y *= -1; isRebound = true; }
        if (isRebound) this.updateRotationImmediately();

        this.node.setPosition(clampedPos);
        this.updateRotationImmediately();
    }

    private resetRandomDirection() {
        this.targetDir.x = Math.random() * 2 - 1;
        this.targetDir.y = Math.random() * 2 - 1;
        this.targetDir.z = 0;
        this.targetDir.normalize();
    }

    private getTargetAngle(): number {
        let angle = Math.atan2(this.targetDir.x, -this.targetDir.y) * 180 / Math.PI;
        angle = (angle % 360 + 360) % 360;
        return angle;
    }

    private updateRotationImmediately() {
        const targetAngle = this.getTargetAngle();
        this.node.eulerAngles = new Vec3(0, 0, targetAngle);
    }
}
