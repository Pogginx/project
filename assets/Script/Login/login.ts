import { _decorator, Component, EditBox, Label, director, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoginScene')
export class LoginScene extends Component {
    @property(EditBox)
    private accountEditBox: EditBox = null;
    
    @property(EditBox)
    private passwordEditBox: EditBox = null;

    @property(Node)
    registerNode:Node = null;
    

    start() {
        // 可选：自动填充上次保存的账号
        const savedAccount = localStorage.getItem("account");
        if (savedAccount && this.accountEditBox) {
            this.accountEditBox.string = savedAccount;
        }

        const reNode = this.registerNode;
    }

    // 登录按钮点击事件
    onLoginBtnClick() {
        const inputAccount = this.accountEditBox.string;
        const inputPassword = this.passwordEditBox.string;
        
        console.log("登录账号:", inputAccount);  // 调试用
        console.log("登录密码:", inputPassword); // 调试用
        
        // 读取保存的账号密码
        const savedAccount = localStorage.getItem("account");
        const savedPassword = localStorage.getItem("password");
        
        if (inputAccount === savedAccount && inputPassword === savedPassword) {
            this.showLoginTip("登录成功！");
            // 跳转到游戏主界面
            this.scheduleOnce(() => {
                director.loadScene("game");
            }, 0.5);
        } else {
            if(inputAccount != savedAccount){
                this.showLoginTip("账号错误！");
            }
            else if(inputPassword != savedPassword){
                this.showLoginTip("密码错误！");
            } 
            return;
        }
    }

    //打开注册界面
    openRigisterScene(){
        //显示注册
        this.registerNode.active = true;
        //隐形登录
        this.node.active = false;
    }
    
    //系统消息
    private showLoginTip(message: string) {
        alert(message);
    }
}

