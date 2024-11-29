class StockAPI {
    constructor() {
        this.apiKey = 'TTF064BFM30J8ABQ';
        this.lastRequestTime = 0;
        this.cache = new Map();
        this.cacheExpiration = 5 * 60 * 1000; // 缓存5分钟
    }

    async fetchStockData(symbol) {
        try {
            // 检查缓存
            const cachedData = this.cache.get(symbol);
            if (cachedData && (Date.now() - cachedData.timestamp) < this.cacheExpiration) {
                console.log('Using cached data for', symbol);
                return cachedData.data;
            }

            // 检查请求频率
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < 12000) { // 12秒限制
                throw new Error('请等待12秒后再次查询');
            }
            
            this.lastRequestTime = now;

            // 构建API URL
            const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${this.apiKey}`;
            
            console.log('Fetching data for', symbol);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('网络请求失败');
            }

            const data = await response.json();

            // 检查API错误
            if (data['Error Message']) {
                throw new Error('股票代码无效或不存在');
            }

            if (data['Note']) {
                throw new Error('API调用频率超限，请稍后再试');
            }

            // 格式化数据
            const formattedData = this.formatData(data['Time Series (Daily)']);
            
            // 更新缓存
            this.cache.set(symbol, {
                timestamp: Date.now(),
                data: formattedData
            });

            return formattedData;
        } catch (error) {
            console.error('获取股票数据时出错:', error);
            throw error;
        }
    }

    formatData(timeSeriesData) {
        const formattedData = [];
        const dates = Object.keys(timeSeriesData).sort().reverse();
        const recentDates = dates.slice(0, 250); // 只取最近250天的数据
        
        for (const date of recentDates) {
            const dayData = timeSeriesData[date];
            formattedData.push({
                date: date,
                open: parseFloat(dayData['1. open']),
                high: parseFloat(dayData['2. high']),
                low: parseFloat(dayData['3. low']),
                close: parseFloat(dayData['4. close']),
                volume: parseInt(dayData['5. volume'])
            });
        }
        
        return formattedData;
    }
}

class ChartManager {
    constructor() {
        this.mainChart = echarts.init(document.getElementById('mainChart'));
        this.currentPeriod = 250;
        this.fullData = [];
        
        window.addEventListener('resize', () => {
            this.mainChart.resize();
        });
    }

    renderChart(data) {
        // 计算收盘价数组
        const closePrices = data.map(item => item.close);
        
        const option = {
            title: { 
                text: `价格走势与成交量分析 (${this.currentPeriod}天)`,
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            legend: {
                data: ['K线', 'MA5', 'MA10', 'MA20', 'MA60', '成交量'],
                top: 30
            },
            grid: [{
                left: '10%',
                right: '10%',
                height: '60%'
            }, {
                left: '10%',
                right: '10%',
                top: '75%',
                height: '15%'
            }],
            xAxis: [{
                type: 'category',
                data: data.map(item => item.date),
                gridIndex: 0
            }, {
                type: 'category',
                data: data.map(item => item.date),
                gridIndex: 1
            }],
            yAxis: [{
                type: 'value',
                scale: true,
                gridIndex: 0
            }, {
                type: 'value',
                gridIndex: 1
            }],
            dataZoom: [{
                type: 'inside',
                xAxisIndex: [0, 1],
                start: 0,
                end: 100
            }, {
                show: true,
                xAxisIndex: [0, 1],
                type: 'slider',
                bottom: 5
            }],
            series: [
                {
                    name: 'K线',
                    type: 'candlestick',
                    data: data.map(item => [
                        item.open,
                        item.close,
                        item.low,
                        item.high
                    ]),
                    xAxisIndex: 0,
                    yAxisIndex: 0
                },
                {
                    name: 'MA5',
                    type: 'line',
                    data: this.calculateMA(5, closePrices),
                    smooth: true,
                    lineStyle: { opacity: 0.5 },
                    xAxisIndex: 0,
                    yAxisIndex: 0
                },
                {
                    name: 'MA10',
                    type: 'line',
                    data: this.calculateMA(10, closePrices),
                    smooth: true,
                    lineStyle: { opacity: 0.5 },
                    xAxisIndex: 0,
                    yAxisIndex: 0
                },
                {
                    name: 'MA20',
                    type: 'line',
                    data: this.calculateMA(20, closePrices),
                    smooth: true,
                    lineStyle: { opacity: 0.5 },
                    xAxisIndex: 0,
                    yAxisIndex: 0
                },
                {
                    name: 'MA60',
                    type: 'line',
                    data: this.calculateMA(60, closePrices),
                    smooth: true,
                    lineStyle: { opacity: 0.5 },
                    xAxisIndex: 0,
                    yAxisIndex: 0
                },
                {
                    name: '成交量',
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: data.map(item => item.volume),
                    smooth: true,
                    lineStyle: { 
                        width: 2,
                        opacity: 0.8
                    },
                    areaStyle: { 
                        opacity: 0.2
                    },
                    symbol: 'none'
                }
            ]
        };
        
        this.mainChart.setOption(option);
    }

    // 添加 calculateMA 方法
    calculateMA(days, prices) {
        const result = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < days - 1) {
                result.push('-');
                continue;
            }
            let sum = 0;
            for (let j = 0; j < days; j++) {
                sum += prices[i - j];
            }
            result.push((sum / days).toFixed(2));
        }
        return result;
    }

    changePeriod(period) {
        this.currentPeriod = period;
        const data = this.fullData.slice(-period);
        this.renderChart(data);
    }
}

class StockAnalyzer {
    analyze(data) {
        const marketCharacter = this.determineMarketCharacter(data);
        
        return {
            ma20Analysis: this.analyzeTrend(data, marketCharacter),
            volumePriceAnalysis: this.analyzeVolumePrice(data, marketCharacter),
            marketCharacter: this.explainMarketCharacter(data, marketCharacter),
            operationAdvice: this.generateOperationAdvice(data, marketCharacter)
        };
    }

    // 解释市场特征
    explainMarketCharacter(data, marketCharacter) {
        const prices = data.map(item => item.close);
        const ma20 = this.calculateMA(20, prices);
        const latestPrice = prices[prices.length - 1];
        const priceChange = this.calculatePriceChange(prices, 20);
        
        let explanation = "市场特征分析：\n";
        
        switch(marketCharacter) {
            case 'bullish':
                explanation += "多头市场特征\n";
                explanation += "1. 均线系统多头排列\n";
                explanation += `2. 价格站稳MA20上方 (当前MA20: ${ma20.toFixed(2)})\n`;
                explanation += `3. 20天涨幅${priceChange.toFixed(2)}%，成交量明显放大\n`;
                break;
                
            case 'bearish':
                explanation += "空头市场特征\n";
                explanation += "1. 均线系统空头排列\n";
                explanation += `2. 价格位于MA20下方 (当前MA20: ${ma20.toFixed(2)})\n`;
                explanation += `3. 20天跌幅${priceChange.toFixed(2)}%，成交量明显放大\n`;
                break;
                
            default:
                explanation += "盘整市场特征\n";
                explanation += "1. 均线系统交织\n";
                explanation += `2. 价格在MA20(${ma20.toFixed(2)})附近波动\n`;
                explanation += "3. 成交量和涨跌幅度均未达到趋势场特征\n";
        }
        
        return explanation;
    }

    // 合并后的趋势分析
    analyzeTrend(data, marketCharacter) {
        const prices = data.map(item => item.close);
        const ma20 = this.calculateMA(20, prices);
        const latestPrice = prices[prices.length - 1];
        const priceStability = this.checkPriceStability(prices, ma20);
        const ma20Trend = this.calculateMA20Trend(prices);
        
        let analysis = "MA20核心指标分析：\n";
        analysis += `当前MA20：${ma20.toFixed(2)}\n`;
        analysis += `价格位置：${this.getPricePositionText(priceStability)}\n`;
        analysis += `MA20形态：${this.getMA20TrendText(ma20Trend)}\n`;
        
        return analysis;
    }

    getPricePositionText(stability) {
        switch(stability) {
            case 'above': return "站稳MA20上方";
            case 'below': return "跌破MA20下方";
            default: return "在MA20附近徘徊";
        }
    }

    getMA20TrendText(trend) {
        switch(trend) {
            case 'up': return "向上倾斜（趋势向好）";
            case 'down': return "向下倾斜（趋势转弱）";
            default: return "横盘震荡";
        }
    }

    // 分析量价配合
    analyzeVolumePrice(data, marketCharacter) {
        const volumes = data.map(item => item.volume);
        const prices = data.map(item => item.close);
        const volumeChange = this.calculateVolumeChange(volumes);
        const priceChange = this.calculatePriceChange(prices, 20);
        
        let analysis = "量价配合分析：\n";
        analysis += `成交量变化：${volumeChange.toFixed(2)}%\n`;
        analysis += `价格涨跌幅：${priceChange.toFixed(2)}%\n\n`;
        
        // 根据量价变化判断市场状态
        if (volumeChange > 30) {
            if (priceChange > 8) {
                analysis += "放量上涨，买盘积极";
            } else if (priceChange < -8) {
                analysis += "放量下跌，卖盘活跃";
            }
        } else if (volumeChange < -30) {
            if (priceChange > 8) {
                analysis += "缩量上涨，上涨乏力";
            } else if (priceChange < -8) {
                analysis += "缩量下跌，下跌趋缓";
            }
        } else {
            analysis += "成交量基本平稳";
        }
        
        return analysis;
    }

    determineMarketCharacter(data) {
        const prices = data.map(item => item.close);
        const volumes = data.map(item => item.volume);
        const ma20 = this.calculateMA(20, prices);
        const latestPrice = prices[prices.length - 1];
        
        // 判断价格是否站稳MA20
        const priceStability = this.checkPriceStability(prices, ma20);
        // 判断MA20斜率
        const ma20Trend = this.calculateMA20Trend(prices);
        // 计算20天涨跌幅和成交量变化
        const priceChange = this.calculatePriceChange(prices, 20);
        const volumeChange = this.calculateVolumeChange(volumes);

        // 多头市场判断（三个条件都满足）
        if (priceStability === 'above' && 
            ma20Trend === 'up' && 
            priceChange > 8 && 
            volumeChange > 30) {
            return 'bullish';
        }
        
        // 空头市场判断（三个条件都满足）
        if (priceStability === 'below' && 
            ma20Trend === 'down' && 
            priceChange < -8 && 
            volumeChange > 30) {
            return 'bearish';
        }
        
        return 'ranging';
    }

    // 新增：检查价格站稳/跌破MA20的状态
    checkPriceStability(prices, ma20) {
        const recentPrices = prices.slice(-3);
        const deviations = recentPrices.map(price => (price - ma20) / ma20 * 100);
        
        if (deviations.every(dev => dev > 0 && dev <= 8)) {
            return 'above'; // 站稳
        }
        if (deviations.every(dev => dev < 0 && dev <= -3)) {
            return 'below'; // 跌破
        }
        return 'ranging'; // 徘徊
    }

    // 新增：计算MA20斜率
    calculateMA20Trend(prices) {
        const ma20Values = [];
        for (let i = 20; i < prices.length; i++) {
            const ma = this.calculateMA(20, prices.slice(0, i + 1));
            ma20Values.push(ma);
        }
        
        // 计算最近20天MA20的斜率
        const recentMA20 = ma20Values.slice(-20);
        const slope = (recentMA20[recentMA20.length - 1] - recentMA20[0]) / 20;
        const angle = Math.atan(slope) * (180 / Math.PI);
        
        if (angle > 30) return 'up';
        if (angle < -30) return 'down';
        return 'flat';
    }

    generateOperationAdvice(data, marketCharacter) {
        const prices = data.map(item => item.close);
        const ma20 = this.calculateMA(20, prices);
        const latestPrice = prices[prices.length - 1];
        
        let advice = "操作建议：\n\n";
        
        switch(marketCharacter) {
            case 'bullish':
                advice += "【未持有】\n";
                advice += "1. 回调买入策略：\n";
                advice += `   - 等待回调至MA20（${ma20.toFixed(2)}）附近\n`;
                advice += "   - 站稳确认：连续3天收盘价站在MA20上方，且偏离度不超过8%\n";
                advice += "   - 分批买入：\n";
                advice += "     第一批：确认���稳后买入40%仓位\n";
                advice += "     第二批：突破前期高点买入30%仓位\n";
                advice += "     第三批：调整企稳后补充20%仓位\n";
                advice += `   - 止损位设在MA20下方3%（${(ma20 * 0.97).toFixed(2)}）\n\n`;
                
                advice += "【已持有】\n";
                advice += "1. 持股策略：\n";
                advice += "   - 当前维持90%以上仓位\n";
                advice += "   - 加仓机会判断（满足以下三个条件可加仓10%）：\n";
                advice += "     1) MA20持续向上倾斜\n";
                advice += "     2) 股价站稳MA20上方\n";
                advice += "     3) 成交量较前期有30%以上增幅\n";
                advice += "2. 止损条件：\n";
                advice += `   - 跌破MA20（${ma20.toFixed(2)}）三天\n`;
                advice += "   - 成交量异常放大（较前期增幅超过100%）\n";
                break;
                
            case 'bearish':
                advice += "【未持有】\n";
                advice += "1. 观望为主：\n";
                advice += "   - 暂不考虑买入\n";
                advice += "   - 等待买入机会（需同时满足以下条件）：\n";
                advice += "     1) MA20由下跌转为平缓或上扬\n";
                advice += "     2) 连续5天股价运行在MA20上下3%范围内\n";
                advice += "     3) 成交量较前期下降30%以上\n";
                advice += "   - 满足条件后：先买入20%试探仓位\n";
                advice += "   - 确认突破MA20后：可再买入30%仓位\n\n";
                
                advice += "【已持有】\n";
                advice += "1. 分批减仓策略：\n";
                advice += `   - 第一批：反弹至MA20（${ma20.toFixed(2)}）时卖出50%仓位\n`;
                advice += "   - 第二批：若突破MA20，等反弹乏力时卖出30%\n";
                advice += "   - 第三批：剩余仓位设置跟踪止损\n";
                advice += "2. 仓位控制：\n";
                advice += "   - 最终降至30%以下观察仓位\n";
                advice += "   - 若跌破前期低点，清空所有仓位\n";
                break;
                
            default: // 盘整市场
                advice += "【未持有】\n";
                advice += "1. 观望为主：\n";
                advice += "   - 等待趋势明确\n";
                advice += "   - 可在MA20下方3%买入20%试探仓位\n";
                advice += `   - 严格止损MA20（${ma20.toFixed(2)}）下方5%\n\n`;
                
                advice += "【已持有】\n";
                advice += "1. 区间操作策略：\n";
                advice += "   - 基准仓位控制在50%\n";
                advice += "   - 高抛：股价上涨至MA20上方5%时卖出20%仓位\n";
                advice += "   - 低吸：股价回调至MA20下方3%时买回\n";
                advice += "   - 注意：区间操作仅限于基准仓位的20%\n";
                advice += "2. 离场条件：\n";
                advice += "   - 股价跌破MA20下方5%\n";
                advice += "   - 成交量较前期突然放大50%以上\n";
        }
        
        return advice;
    }

    // 计算移动平均线
    calculateMA(days, prices) {
        const result = [];
        for (let i = days - 1; i < prices.length; i++) {
            const sum = prices.slice(i - days + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / days);
        }
        return result[result.length - 1];
    }

    // 计算成交量变化
    calculateVolumeChange(volumes) {
        const recent = volumes.slice(-5);
        const previous = volumes.slice(-10, -5);
        const recentAvg = this.calculateAverage(recent);
        const previousAvg = this.calculateAverage(previous);
        return ((recentAvg - previousAvg) / previousAvg) * 100;
    }

    // 计算平均值
    calculateAverage(array) {
        return array.reduce((a, b) => a + b, 0) / array.length;
    }

    // 计算涨跌幅
    calculatePriceChange(prices, days) {
        const latestPrice = prices[prices.length - 1];
        const previousPrice = prices[prices.length - 1 - days];
        return ((latestPrice - previousPrice) / previousPrice) * 100;
    }

    // 判断均线排列
    checkMAAlignment(ma5, ma10, ma20, ma60) {
        const isBullish = ma5 > ma10 && ma10 > ma20 && ma20 > ma60;
        const isBearish = ma5 < ma10 && ma10 < ma20 && ma20 < ma60;
        return { isBullish, isBearish };
    }
}

class StockController {
    constructor() {
        this.api = new StockAPI();
        this.chartManager = new ChartManager();
        this.analyzer = new StockAnalyzer();
        this.loading = document.getElementById('loading');
        this.errorMessage = document.getElementById('errorMessage');
    }
    
    showLoading() {
        this.loading.style.display = 'block';
    }
    
    hideLoading() {
        this.loading.style.display = 'none';
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }
    
    hideError() {
        this.errorMessage.style.display = 'none';
    }
    
    async analyzeStock(symbol) {
        try {
            this.hideError();
            this.showLoading();
            
            const data = await this.api.fetchStockData(symbol);
            this.chartManager.renderChart(data);
            
            const analysis = this.analyzer.analyze(data);
            
            // 使用新的方法设内容
            setTextareaContent('ma20Analysis', analysis.ma20Analysis);
            setTextareaContent('volumePriceAnalysis', analysis.volumePriceAnalysis);
            setTextareaContent('marketCharacter', analysis.marketCharacter);
            setTextareaContent('operationAdvice', analysis.operationAdvice);
            
        } catch (error) {
            this.showError(`处理出错：${error.message}`);
        } finally {
            this.hideLoading();
        }
    }
}

// 将这些函数声明为全局函数
window.analyzeStock = function() {
    const stockCode = document.getElementById('stockCode').value.trim().toUpperCase();
    if (!stockCode) {
        controller.showError('请输入股票代码');
        return;
    }
    if (!/^[A-Z]{1,5}$/.test(stockCode)) {
        controller.showError('请输入正确的美股代码格式');
        return;
    }
    controller.analyzeStock(stockCode);
}

window.changePeriod = function() {
    const period = parseInt(document.getElementById('periodSelector').value);
    controller.chartManager.changePeriod(period);
}

// 确保 controller 也是全局可访问的
window.controller = new StockController();
