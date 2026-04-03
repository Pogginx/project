import { _decorator, Component, Node, input, Input, EventMouse, Vec3, UITransform } from 'cc';
import {MapConfig} from './EcologyData'
const { ccclass, property } = _decorator;

@ccclass('MapDragController')
export class MapDragController extends Component {
    @property(Node)
    creatureAnimalNode: Node = null!;
    
    @property
    enableDrag: boolean = true;
    
    @property
    dragSpeed: number = 1.0;
    
    @property
    borderPadding: number = 0;
    
    private isDragging: boolean = false;
    private lastMousePos: Vec3 = new Vec3();
    private mapMinX: number = 0;
    private mapMaxX: number = 0;
    private mapMinY: number = 0;
    private mapMaxY: number = 0;
    
    // 地图和视口尺寸
    private mapWidth: number = MapConfig.MAP_SIZE;
    private mapHeight: number = MapConfig.MAP_SIZE;
    private viewWidth: number = MapConfig.CANVAS_WIDTH;
    private viewHeight: number = MapConfig.CANVAS_HEIGHT;
    
    start() {
        this.initBoundaries();
        this.registerEvents();
    }
    
    private initBoundaries() {
        if (!this.creatureAnimalNode) {
            console.error('请指定地图节点 creatureAnimalNode');
            return;
        }
        
        // 获取地图节点的UITransform组件来确认尺寸
        const mapTransform = this.creatureAnimalNode.getComponent(UITransform);
        if (mapTransform) {
            this.mapWidth = mapTransform.width;
            this.mapHeight = mapTransform.height;
        }
        
        // 计算边界
        // 当地图中心在(0,0)时，地图左边缘在 -1500，右边缘在 +1500
        // 视口宽720，所以视口左边缘在 -360，右边缘在 +360
        
        // 地图可以向右移动的最大距离：当地图左边缘对齐视口左边缘时
        this.mapMaxX = (this.mapWidth / 2) - (this.viewWidth / 2);
        
        // 地图可以向左移动的最大距离：当地图右边缘对齐视口右边缘时
        this.mapMinX = -(this.mapWidth / 2) + (this.viewWidth / 2);
        
        // Y轴同理
        this.mapMaxY = (this.mapHeight / 2) - (this.viewHeight / 2);
        this.mapMinY = -(this.mapHeight / 2) + (this.viewHeight / 2);
        
        console.log(`地图移动范围: X[${this.mapMinX}, ${this.mapMaxX}], Y[${this.mapMinY}, ${this.mapMaxY}]`);
    }
    
    private registerEvents() {
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
    
    private onMouseDown(event: EventMouse) {
        if (event.getButton() === 0 && this.enableDrag) {
            this.isDragging = true;
            // 记录鼠标按下时的位置（世界坐标）
            this.lastMousePos.set(event.getLocationX(), event.getLocationY(), 0);
            
            // 可选：改变鼠标样式
            // this.node.parent!.emit('cursor-change', 'grabbing');
        }
    }
    
    private onMouseMove(event: EventMouse) {
        if (!this.isDragging || !this.creatureAnimalNode) return;
        
        // 获取当前鼠标位置
        const currentMousePos = new Vec3(event.getLocationX(), event.getLocationY(), 0);
        
        // 计算鼠标移动的偏移量
        const deltaX = currentMousePos.x - this.lastMousePos.x;
        const deltaY = currentMousePos.y - this.lastMousePos.y;
        
        // 核心修复：鼠标拖动方向与地图移动方向的关系
        // 所以地图的新位置 = 当前位置 + 鼠标偏移量
        
        const currentPos = this.creatureAnimalNode.position.clone();
        let newX = currentPos.x + deltaX * this.dragSpeed;
        let newY = currentPos.y + deltaY * this.dragSpeed;
        
        // 边界限制
        newX = Math.max(this.mapMinX, Math.min(this.mapMaxX, newX));
        newY = Math.max(this.mapMinY, Math.min(this.mapMaxY, newY));
        
        // 应用新位置
        this.creatureAnimalNode.setPosition(newX, newY, currentPos.z);
        
        // 更新上一次鼠标位置
        this.lastMousePos.set(currentMousePos);
    }
    
    private onMouseUp(event: EventMouse) {
        if (event.getButton() === 0) {
            this.isDragging = false;
            // 恢复鼠标样式
            // this.node.parent!.emit('cursor-change', 'grab');
        }
    }
    
    private onMouseLeave(event: EventMouse) {
        this.isDragging = false;
    }
    
    /**
     * 重置地图到中心
     */
    resetToCenter() {
        if (!this.creatureAnimalNode) return;
        this.creatureAnimalNode.setPosition(0, 0, 0);
    }
    
    /**
     * 移动到指定坐标
     */
    moveTo(x: number, y: number) {
        if (!this.creatureAnimalNode) return;
        
        let newX = Math.max(this.mapMinX, Math.min(this.mapMaxX, x));
        let newY = Math.max(this.mapMinY, Math.min(this.mapMaxY, y));
        
        this.creatureAnimalNode.setPosition(newX, newY, 0);
    }
    
    onDestroy() {
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
}