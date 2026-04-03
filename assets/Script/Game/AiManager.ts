// AiManager.ts
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('AiManager')
export class AiManager extends Component {
    private apiUrl = 'http://localhost:3000/api/ai-decision'; // 代理地址

    // AiManager.ts 中的 requestIntervention 方法
public async requestIntervention(ecologyData: any): Promise<{ action: string | null; reason: string } | null> {
    const prompt = this.buildPrompt(ecologyData);
    console.log(123);
    const systemPrompt = `你是一个专业的生态管理系统AI，负责根据当前环境数据选择最合适的人工干预措施。
可选干预类型：RAIN（降雨）、SNOW（降雪）、ADD_CO2（增加二氧化碳）、CLEAN（清除尸体）、null（不做干扰）。
请根据以下规则决策：
- 如果湿度低于30%且温度高于20°C，优先考虑RAIN（湿度高于60%禁止返回RAIN）。
- 如果温度高于30°C，优先考虑SNOW。
- 如果CO2浓度低于300ppm，优先考虑ADD_CO2。
- 如果尸体数量超过50个，优先考虑CLEAN。
- 如果多项指标异常，选择最紧迫的一项。
- 如果一切正常，可以选择不干预（返回null）。

请以严格的JSON格式返回，包含两个字段：
- action: 字符串，值为 "RAIN"、"SNOW"、"ADD_CO2"、"CLEAN" 或 "null"
- reason: 字符串，简要说明决策依据（例如“湿度低于30%且温度高于20°C，建议降雨”）

不要返回任何额外的文字、标点或空格，只返回JSON对象。`;

    try {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 100  // 增加 token 以容纳 reason
            })
        });

        if (!response.ok) {
            console.error('AI请求失败:', response.status, response.statusText);
            return null;
        }

        const result = await response.json();
        const raw = result.choices?.[0]?.message?.content?.trim() || '';
        
        // 尝试解析 JSON
        try {
            const parsed = JSON.parse(raw);
            const action = parsed.action === 'null' ? null : parsed.action;
            const reason = parsed.reason || '无理由';
            // 验证 action 是否为有效值
            if (action === null || ['RAIN', 'SNOW', 'ADD_CO2', 'CLEAN'].indexOf(action)  !== -1) {
                return { action, reason };
            } else {
                console.warn('AI返回了无效的 action:', action);
            }
        } catch (e) {
            // JSON 解析失败，回退到原逻辑（仅提取类型）
            console.warn('AI返回内容无法解析为JSON，尝试提取干预类型:', raw);
            const match = raw.match(/\b(RAIN|SNOW|ADD_CO2|CLEAN|null)\b/);
            if (match) {
                const action = match[1] === 'null' ? null : match[1];
                return { action, reason: 'AI未提供理由' };
            } else {
                console.warn('AI返回了无效的干预类型:', raw);
                return null;
            }
        }
    } catch (error) {
        console.error('AI请求异常:', error);
        return null;
    }
    return null; // 防御性返回
}

    private buildPrompt(data: any): string {
        return `当前环境数据：
- 温度：${data.envData.temperature.toFixed(1)}°C
- 湿度：${data.envData.humidity.toFixed(1)}%
- O2浓度：${Math.floor(data.envData.gas.O2)} ppm
- CO2浓度：${Math.floor(data.envData.gas.CO2)} ppm
- 生产者占比：${data.creatureRatio.PRODUCER?.toFixed(1) || 0}%
- 消费者占比：${data.creatureRatio.CONSUMER?.toFixed(1) || 0}%
- 分解者占比：${data.creatureRatio.DECOMPOSER?.toFixed(1) || 0}%
- 尸体数量：${data.corpseCount}

请根据规则选择最合适的干预类型。`;
    }
}