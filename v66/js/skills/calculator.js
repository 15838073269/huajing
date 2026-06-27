/**
 * ============================================
 *   高精度计算器插件 - v66 技能
 *   从 v64/js/math.js 提取核心计算功能
 * ============================================
 *
 * 功能：
 * - 高精度运算: add, subtract, multiply, divide, mod, compare
 * - 科学函数: power, nthRoot, sqrt, abs, factorial, log, ln, sin, cos, tan, csc, sec, cot
 * - 表达式解析: tokenize() + parseExpression() (递归下降解析器)
 * - 在世界中创建可拖拽计算卡片
 * - 支持变量赋值: x = 100, y = x * 2
 * - 帮助对话框显示支持的函数列表
 */

var CalculatorSkill = {

    // ===== 基本信息 =====
    id: 'calculator',
    name: '计算器',
    icon: '<span style="color:#38bdf8;">算</span>',
    category: '工具',
    description: '科学计算器，支持变量和表达式解析',
    key: '7',

    // ===== 内部状态 =====
    _world: null,
    _layer: null,
    _cards: [],               // 计算卡片DOM元素列表
    _variables: {},           // 变量存储 { name: value }
    _cardIdCounter: 0,        // 卡片ID计数器

    // ===== 数学常数 =====
    _constants: {
        'e': Math.E.toString(),
        'pi': Math.PI.toString(),
        'PI': Math.PI.toString(),
        'Pi': Math.PI.toString()
    },

    // ===== 生命周期 =====

    activate: function(world) {
        var self = this;
        this._world = world;
        this._layer = world.getLayer();

        // 更新子工具栏
        SkillSystem.renderSubTools();

        // 如果已有卡片（切换回来），不重复绑定事件
        if (this._cards.length > 0) return;

        // 双击空白处创建新卡片（只绑定一次）
        this._onDblClick = function(e) {
            if (e.target.closest('[data-cos-deletable], textarea, button, input')) return;
            var pos = world.screenToWorld(e.clientX, e.clientY);
            self._createCalculatorCard(pos.x - 150, pos.y - 80);
        };
        document.addEventListener('dblclick', this._onDblClick);

        // 首次激活：恢复保存的数据或创建默认卡片
        if (this._pendingLoad) {
            var data = this._pendingLoad;
            this._pendingLoad = null;
            if (data.variables) this._variables = data.variables;
            if (data.cardIdCounter) this._cardIdCounter = data.cardIdCounter;
            if (data.cards && data.cards.length > 0) {
                var self2 = this;
                data.cards.forEach(function(cd) {
                    var card = self2._createCalculatorCard(cd.x, cd.y);
                    var input = card.querySelector('.calc-input');
                    if (input) {
                        input.value = cd.expression || '';
                        if (cd.expression) self2._evaluateInput(input);
                    }
                });
            } else {
                setTimeout(function() { self._createCalculatorCard(); }, 100);
            }
        } else {
            setTimeout(function() { self._createCalculatorCard(); }, 100);
        }
    },

    deactivate: function() {
        // 不解绑事件，卡片始终可交互
    },

    // ===== 子工具栏 =====

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '增',
                action: function() {
                    self._createCalculatorCard();
                }
            },
            {
                label: '帮',
                action: function() {
                    self._showHelpDialog();
                }
            },
            {
                label: '删',
                action: function() {
                    // 移除所有卡片DOM
                    self._cards.forEach(function(card) {
                        if (card._cleanup) card._cleanup();
                        if (card.parentNode) card.parentNode.removeChild(card);
                    });
                    self._cards = [];
                    self._variables = {};
                    self._cardIdCounter = 0;
                    // 解绑双击事件，下次 activate 会重新绑定
                    if (self._onDblClick) {
                        document.removeEventListener('dblclick', self._onDblClick);
                        self._onDblClick = null;
                    }
                    if (typeof autoSave === 'function') autoSave();
                }
            }
        ];
    },

    // ===== 保存/恢复 =====

    save: function() {
        // 保存变量和卡片数据
        var cardsData = [];
        this._cards.forEach(function(card) {
            var input = card.querySelector('.calc-input');
            cardsData.push({
                x: parseInt(card.style.left),
                y: parseInt(card.style.top),
                expression: input ? input.value : ''
            });
        });
        return {
            variables: this._variables,
            cards: cardsData,
            cardIdCounter: this._cardIdCounter
        };
    },

    load: function(data) {
        if (!data) return;
        this._pendingLoad = data;
    },

    // ========================================
    //   高精度运算核心
    // ========================================

    // 辅助：比较两个正数字符串的大小（返回 1, 0, -1）
    _comparePositive: function(num1, num2) {
        var clean = function(str) { return str.replace(/^-|\./g, '').replace(/^0+/, '') || '0'; };
        var n1 = clean(num1);
        var n2 = clean(num2);
        if (n1.length > n2.length) return 1;
        if (n1.length < n2.length) return -1;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
        return 0;
    },

    // 高精度加法
    add: function(a, b) {
        if (a === '0' || a === '-0') return b;
        if (b === '0' || b === '-0') return a;

        var signA = a.startsWith('-');
        var signB = b.startsWith('-');

        if (signA && signB) return '-' + this.add(a.slice(1), b.slice(1));
        if (signA) return this.subtract(b, a.slice(1));
        if (signB) return this.subtract(a, b.slice(1));

        // 正数相加
        var scale = 0;
        if (a.includes('.')) scale = Math.max(scale, a.split('.')[1].length);
        if (b.includes('.')) scale = Math.max(scale, b.split('.')[1].length);

        var intA = a.replace('.', '') + '0'.repeat(scale - (a.includes('.') ? a.split('.')[1].length : 0));
        var intB = b.replace('.', '') + '0'.repeat(scale - (b.includes('.') ? b.split('.')[1].length : 0));

        var maxLen = Math.max(intA.length, intB.length);
        var padA = intA.padStart(maxLen, '0');
        var padB = intB.padStart(maxLen, '0');

        var result = '';
        var carry = 0;

        for (var i = maxLen - 1; i >= 0; i--) {
            var sum = (padA[i] | 0) + (padB[i] | 0) + carry;
            result = (sum % 10) + result;
            carry = sum / 10 | 0;
        }
        if (carry) result = carry + result;

        if (scale > 0) {
            while (result.length < scale + 1) result = '0' + result;
            result = result.slice(0, -scale) + '.' + result.slice(-scale);
        }

        result = result.replace(/^0+/, '') || '0';
        if (result.startsWith('.')) result = '0' + result;
        if (result !== '0' && result.includes('.')) {
            result = result.replace(/0+$/, '').replace(/\.$/, '');
        }
        return result;
    },

    // 高精度减法
    subtract: function(a, b) {
        if (b === '0' || b === '-0') return a;
        if (a === '0' || a === '-0') return '-' + b;

        var signA = a.startsWith('-');
        var signB = b.startsWith('-');

        if (signA && !signB) return '-' + this.add(a.slice(1), b);
        if (!signA && signB) return this.add(a, b.slice(1));
        if (signA && signB) return this.subtract(b.slice(1), a.slice(1));

        var cmp = this.compare(a, b);
        if (cmp === 0) return '0';
        if (cmp < 0) return '-' + this.subtract(b, a);

        // a > b > 0
        var scale = 0;
        if (a.includes('.')) scale = Math.max(scale, a.split('.')[1].length);
        if (b.includes('.')) scale = Math.max(scale, b.split('.')[1].length);

        var intA = a.replace('.', '') + '0'.repeat(scale - (a.includes('.') ? a.split('.')[1].length : 0));
        var intB = b.replace('.', '') + '0'.repeat(scale - (b.includes('.') ? b.split('.')[1].length : 0));

        var maxLen = Math.max(intA.length, intB.length);
        var padA = intA.padStart(maxLen, '0');
        var padB = intB.padStart(maxLen, '0');

        var result = '';
        var borrow = 0;

        for (var i = maxLen - 1; i >= 0; i--) {
            var digit = (padA[i] | 0) - borrow;
            var sub = padB[i] | 0;
            if (digit < sub) { digit += 10; borrow = 1; }
            else { borrow = 0; }
            result = (digit - sub) + result;
        }

        if (scale > 0) {
            while (result.length < scale + 1) result = '0' + result;
            result = result.slice(0, -scale) + '.' + result.slice(-scale);
        }

        result = result.replace(/^0+/, '') || '0';
        if (result.startsWith('.')) result = '0' + result;
        if (result !== '0' && result.includes('.')) {
            result = result.replace(/0+$/, '').replace(/\.$/, '');
        }
        return result;
    },

    // 高精度乘法
    multiply: function(a, b) {
        if (a === '0' || b === '0') return '0';

        var signA = a.startsWith('-');
        var signB = b.startsWith('-');
        var resultSign = (signA !== signB) ? '-' : '';

        a = signA ? a.slice(1) : a;
        b = signB ? b.slice(1) : b;

        // 处理常数
        a = this._constants[a] || a;
        b = this._constants[b] || b;

        a = a.replace(/^0+/, '') || '0';
        b = b.replace(/^0+/, '') || '0';

        var decimalPlacesA = 0;
        var decimalPlacesB = 0;

        if (a.includes('.')) {
            var partsA = a.split('.');
            decimalPlacesA = partsA[1].length;
            a = partsA[0] + partsA[1];
        }
        if (b.includes('.')) {
            var partsB = b.split('.');
            decimalPlacesB = partsB[1].length;
            b = partsB[0] + partsB[1];
        }

        var totalDecimalPlaces = decimalPlacesA + decimalPlacesB;

        if (totalDecimalPlaces === 0 && a.length < 15 && b.length < 15) {
            var result = (parseInt(a) * parseInt(b)).toString();
            return resultSign + result;
        }

        var reversedA = a.split('').reverse();
        var reversedB = b.split('').reverse();
        var resultArr = new Array(a.length + b.length).fill(0);

        for (var i = 0; i < reversedA.length; i++) {
            for (var j = 0; j < reversedB.length; j++) {
                var product = parseInt(reversedA[i]) * parseInt(reversedB[j]);
                resultArr[i + j] += product;
                if (resultArr[i + j] >= 10) {
                    resultArr[i + j + 1] += Math.floor(resultArr[i + j] / 10);
                    resultArr[i + j] %= 10;
                }
            }
        }

        for (var k = 0; k < resultArr.length - 1; k++) {
            if (resultArr[k] >= 10) {
                resultArr[k + 1] += Math.floor(resultArr[k] / 10);
                resultArr[k] %= 10;
            }
        }

        while (resultArr.length > 1 && resultArr[resultArr.length - 1] === 0) {
            resultArr.pop();
        }

        var resultStr = resultArr.reverse().join('');

        if (totalDecimalPlaces > 0) {
            while (resultStr.length <= totalDecimalPlaces) {
                resultStr = '0' + resultStr;
            }
            var insertPos = resultStr.length - totalDecimalPlaces;
            resultStr = resultStr.slice(0, insertPos) + '.' + resultStr.slice(insertPos);
        }

        resultStr = resultStr.replace(/^0+/, '') || '0';
        if (resultStr.includes('.')) {
            resultStr = resultStr.replace(/0+$/, '');
            resultStr = resultStr.replace(/\.$/, '');
        }

        if (resultStr === '0') return '0';
        return resultSign + resultStr;
    },

    // 高精度除法
    divide: function(a, b) {
        if (b === '0' || b === '-0') return '错误：除以零';

        var sign = (a.startsWith('-') !== b.startsWith('-')) ? '-' : '';
        a = a.replace(/^-/, '');
        b = b.replace(/^-/, '');

        var scale = 0;
        if (a.includes('.')) {
            var parts = a.split('.');
            a = parts[0] + parts[1];
            scale += parts[1].length;
        }
        if (b.includes('.')) {
            var parts2 = b.split('.');
            b = parts2[0] + parts2[1];
            scale -= parts2[1].length;
        }

        var A = BigInt(a || '0');
        var B = BigInt(b || '0');

        if (B === 0n) return '错误：除以零';

        var integerPart = A / B;
        var remainder = A % B;

        var result = sign + integerPart.toString();

        if (remainder === 0n) {
            return result === '-0' ? '0' : result;
        }

        result += '.';
        var seen = new Map();
        var decimalPos = 0;
        var decimals = [];

        while (remainder !== 0n && decimalPos < 1000) {
            if (seen.has(remainder)) {
                var start = seen.get(remainder);
                var nonRepeat = decimals.slice(0, start).join('');
                var repeat = decimals.slice(start).join('');
                return result + nonRepeat + '(' + repeat + ')';
            }
            seen.set(remainder, decimalPos);
            remainder *= 10n;
            var digit = remainder / B;
            decimals.push(digit.toString());
            remainder %= B;
            decimalPos++;
        }

        var decimalStr = decimals.join('').replace(/0+$/, '');
        if (decimalStr === '') decimalStr = '0';
        result += decimalStr;

        return result === '-0' ? '0' : result;
    },

    // 高精度求余
    mod: function(a, b) {
        if (b === '0') return '错误：除以零';
        if (a === '0') return '0';

        var cleanA = a.replace(/^0+/, '') || '0';
        var cleanB = b.replace(/^0+/, '') || '0';

        var scale = 0;
        var numA = cleanA;
        var numB = cleanB;

        if (numA.includes('.')) {
            scale = Math.max(scale, numA.split('.')[1].length);
        }
        if (numB.includes('.')) {
            scale = Math.max(scale, numB.split('.')[1].length);
        }

        var intA = numA.replace('.', '') + '0'.repeat(scale - (numA.includes('.') ? numA.split('.')[1].length : 0));
        var intB = numB.replace('.', '') + '0'.repeat(scale - (numB.includes('.') ? numB.split('.')[1].length : 0));

        var remainder = intA;
        while (this._comparePositive(remainder, intB) >= 0) {
            remainder = this.subtract(remainder, intB);
        }

        if (scale > 0) {
            if (remainder.length <= scale) {
                remainder = '0'.repeat(scale - remainder.length + 1) + remainder;
            }
            remainder = remainder.slice(0, -scale) + '.' + remainder.slice(-scale);
        }

        remainder = remainder.replace(/^0+/, '') || '0';
        if (remainder.indexOf('.') !== -1) {
            remainder = remainder.replace(/0+$/, '').replace(/\.$/, '');
        }
        return remainder;
    },

    // 比较两个数字字符串（支持负数和小数）
    compare: function(a, b) {
        var isNegativeA = a.startsWith('-');
        var isNegativeB = b.startsWith('-');

        if (isNegativeA && !isNegativeB) return -1;
        if (!isNegativeA && isNegativeB) return 1;

        var absA = isNegativeA ? a.slice(1) : a;
        var absB = isNegativeB ? b.slice(1) : b;

        absA = this._constants[absA] || absA;
        absB = this._constants[absB] || absB;

        absA = absA.replace(/^0+/, '') || '0';
        absB = absB.replace(/^0+/, '') || '0';

        var partsA = absA.split('.');
        var partsB = absB.split('.');
        var intA = partsA[0], decA = partsA[1] || '';
        var intB = partsB[0], decB = partsB[1] || '';

        var maxDec = Math.max(decA.length, decB.length);
        decA = decA.padEnd(maxDec, '0');
        decB = decB.padEnd(maxDec, '0');

        if (intA.length > intB.length) return isNegativeA ? -1 : 1;
        if (intA.length < intB.length) return isNegativeA ? 1 : -1;

        for (var i = 0; i < intA.length; i++) {
            var dA = parseInt(intA[i]);
            var dB = parseInt(intB[i]);
            if (dA > dB) return isNegativeA ? -1 : 1;
            if (dA < dB) return isNegativeA ? 1 : -1;
        }

        for (var j = 0; j < maxDec; j++) {
            var dA2 = parseInt(decA[j] || '0');
            var dB2 = parseInt(decB[j] || '0');
            if (dA2 > dB2) return isNegativeA ? -1 : 1;
            if (dA2 < dB2) return isNegativeA ? 1 : -1;
        }

        return 0;
    },

    // ========================================
    //   科学函数
    // ========================================

    // 字符串转数字
    _strToNum: function(str) {
        if (this._constants[str]) return parseFloat(this._constants[str]);
        var num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    },

    // 数字转字符串
    _numToStr: function(num) {
        if (isNaN(num) || !isFinite(num)) return '错误';
        if (Math.abs(num) > 1e15 || (Math.abs(num) < 1e-10 && num !== 0)) {
            return num.toExponential(10);
        }
        var s = num.toString();
        // 只去除小数部分末尾无意义的零：如 1.500 → 1.5，不处理整数
        if (s.indexOf('.') !== -1) {
            s = s.replace(/0+$/, '').replace(/\.$/, '');
        }
        // 修正浮点精度：如 0.49999999999999994 → 0.5
        if (s.length > 1 && s.indexOf('.') !== -1) {
            var rounded = Math.round(num * 1e10) / 1e10;
            var rs = rounded.toString();
            if (rs.indexOf('.') !== -1) rs = rs.replace(/0+$/, '').replace(/\.$/, '');
            if (rs.length < s.length) s = rs;
        }
        return s;
    },

    // 幂运算
    power: function(base, exponent) {
        var baseNum = this._strToNum(base);
        var expNum = this._strToNum(exponent);
        return this._numToStr(Math.pow(baseNum, expNum));
    },

    // n次根号
    nthRoot: function(base, root) {
        var baseNum = this._strToNum(base);
        var rootNum = this._strToNum(root);
        if (baseNum < 0 && rootNum % 2 === 0) return '错误：负数不能开偶次方';
        return this._numToStr(Math.pow(baseNum, 1 / rootNum));
    },

    // 平方根
    sqrt: function(num) {
        return this.nthRoot(num, '2');
    },

    // 绝对值
    abs: function(num) {
        if (num.startsWith('-')) return num.slice(1);
        return num;
    },

    // 阶乘
    factorial: function(num) {
        var numVal = parseInt(num);
        if (isNaN(numVal) || numVal < 0 || !Number.isInteger(numVal)) {
            return '错误：阶乘仅支持非负整数';
        }
        var result = 1;
        for (var i = 2; i <= numVal; i++) result *= i;
        return result.toString();
    },

    // 对数函数（默认底数10）
    log: function(num, base) {
        var numVal = this._strToNum(num);
        var baseVal = this._strToNum(base || '10');
        if (numVal <= 0 || baseVal <= 0 || baseVal === 1) return '错误：对数参数无效';
        return this._numToStr(Math.log(numVal) / Math.log(baseVal));
    },

    // 自然对数
    ln: function(num) {
        return this.log(num, this._constants.e);
    },

    // 正弦函数（角度制）
    sin: function(angle) {
        var angleRad = this._strToNum(angle) * Math.PI / 180;
        return this._numToStr(Math.sin(angleRad));
    },

    // 余弦函数（角度制）
    cos: function(angle) {
        var angleRad = this._strToNum(angle) * Math.PI / 180;
        return this._numToStr(Math.cos(angleRad));
    },

    // 正切函数（角度制）
    tan: function(angle) {
        var angleRad = this._strToNum(angle) * Math.PI / 180;
        return this._numToStr(Math.tan(angleRad));
    },

    // 余割函数（角度制）
    csc: function(angle) {
        var sinVal = this._strToNum(this.sin(angle));
        if (sinVal === 0) return '错误：余割函数无效';
        return this._numToStr(1 / sinVal);
    },

    // 正割函数（角度制）
    sec: function(angle) {
        var cosVal = this._strToNum(this.cos(angle));
        if (cosVal === 0) return '错误：正割函数无效';
        return this._numToStr(1 / cosVal);
    },

    // 余切函数（角度制）
    cot: function(angle) {
        var tanVal = this._strToNum(this.tan(angle));
        if (tanVal === 0) return '错误：余切函数无效';
        return this._numToStr(1 / tanVal);
    },

    // ========================================
    //   表达式解析器（递归下降）
    // ========================================

    // 词法分析
    tokenize: function(expression) {
        var tokens = [];
        var regex = /(\d+\.?\d*)|(==|!=|>=|<=|>|<)|([+\-*/^!%,])|(\()|(\))|(\[)|(\])|(\{|\})|(sin|cos|tan|csc|sec|cot|sqrt|abs|log|ln|factorial|nthRoot)|(e|pi|PI|Pi|π)/gi;
        var match;

        while ((match = regex.exec(expression)) !== null) {
            if (match[1]) tokens.push({ type: 'number', value: match[1] });
            else if (match[2]) tokens.push({ type: 'comparison', value: match[2] });
            else if (match[3]) tokens.push({ type: 'operator', value: match[3] });
            else if (match[4]) tokens.push({ type: 'paren', value: '(' });
            else if (match[5]) tokens.push({ type: 'paren', value: ')' });
            else if (match[6]) tokens.push({ type: 'paren', value: '[' });
            else if (match[7]) tokens.push({ type: 'paren', value: ']' });
            else if (match[8]) tokens.push({ type: 'paren', value: match[8] });
            else if (match[9]) tokens.push({ type: 'function', value: match[9] });
            else if (match[10]) tokens.push({ type: 'constant', value: match[10] });
        }

        return tokens;
    },

    // 语法分析和计算
    parseExpression: function(tokens) {
        var index = 0;
        var self = this;

        var peek = function() { return tokens[index]; };
        var consume = function() { return tokens[index++]; };

        // 解析数字、常数、括号、函数、变量
        function parsePrimary() {
            var token = peek();
            if (!token) return '错误';

            // 一元负号
            if (token.type === 'operator' && token.value === '-') {
                consume();
                var operand = parsePrimary();
                if (operand === '错误') return '错误';
                return self.subtract('0', operand);
            }

            // 一元正号
            if (token.type === 'operator' && token.value === '+') {
                consume();
                return parsePrimary();
            }

            if (token.type === 'number') {
                return consume().value;
            }

            if (token.type === 'constant') {
                var constant = consume().value;
                return self._constants[constant] || constant;
            }

            if (token.type === 'function') {
                var func = consume().value;
                consume(); // 跳过 '('

                if (func === 'factorial') {
                    var arg = parseComparison();
                    consume(); // 跳过 ')'
                    return self.factorial(arg);
                }

                if (func === 'nthRoot') {
                    var base = parseComparison();
                    if (peek() && peek().value === ',') {
                        consume();
                        var root = parseComparison();
                        consume();
                        return self.nthRoot(base, root);
                    } else {
                        consume();
                        return self.sqrt(base);
                    }
                }

                if (func === 'log') {
                    var num = parseComparison();
                    if (peek() && peek().value === ',') {
                        consume();
                        var base = parseComparison();
                        consume();
                        return self.log(num, base);
                    } else {
                        consume();
                        return self.log(num);
                    }
                }

                var arg2 = parseComparison();
                consume(); // 跳过 ')'

                switch (func) {
                    case 'sin': return self.sin(arg2);
                    case 'cos': return self.cos(arg2);
                    case 'tan': return self.tan(arg2);
                    case 'csc': return self.csc(arg2);
                    case 'sec': return self.sec(arg2);
                    case 'cot': return self.cot(arg2);
                    case 'sqrt': return self.sqrt(arg2);
                    case 'abs': return self.abs(arg2);
                    case 'ln': return self.ln(arg2);
                    default: return '错误：未知函数';
                }
            }

            // 处理变量名（字母开头的标识符）
            if (token.type === 'operator' || token.value === '(') {
                // 不是变量，继续正常处理
            }

            if (token.value === '(' || token.value === '[' || token.value === '{') {
                var openParen = consume().value;
                var expr = parseComparison();
                var closeParen = { '(': ')', '[': ']', '{': '}' }[openParen];
                if (peek() && peek().value === closeParen) {
                    consume();
                } else {
                    return '错误：括号不匹配';
                }
                return expr;
            }

            return '错误';
        }

        // 解析阶乘后缀
        function parseFactorial() {
            var left = parsePrimary();
            while (peek() && peek().value === '!') {
                consume();
                left = self.factorial(left);
            }
            return left;
        }

        // 解析幂运算（右结合）
        function parsePower() {
            var left = parseFactorial();
            while (peek() && peek().value === '^') {
                consume();
                var right = parsePower();
                left = self.power(left, right);
            }
            return left;
        }

        // 解析乘除求余
        function parseTerm() {
            var left = parsePower();
            while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
                var op = consume().value;
                var right = parsePower();
                switch (op) {
                    case '*': left = self.multiply(left, right); break;
                    case '/': left = self.divide(left, right); break;
                    case '%': left = self.mod(left, right); break;
                }
            }
            return left;
        }

        // 解析加减
        function parseAdditive() {
            var left = parseTerm();
            while (peek() && (peek().value === '+' || peek().value === '-')) {
                var op = consume().value;
                var right = parseTerm();
                switch (op) {
                    case '+': left = self.add(left, right); break;
                    case '-': left = self.subtract(left, right); break;
                }
            }
            return left;
        }

        // 解析比较操作
        function parseComparison() {
            var left = parseAdditive();
            while (peek() && peek().type === 'comparison') {
                var op = consume().value;
                var right = parseAdditive();
                var comparisonResult = self.compare(left, right);
                var boolResult = false;
                switch (op) {
                    case '>': boolResult = comparisonResult > 0; break;
                    case '<': boolResult = comparisonResult < 0; break;
                    case '>=': boolResult = comparisonResult >= 0; break;
                    case '<=': boolResult = comparisonResult <= 0; break;
                    case '==': boolResult = comparisonResult === 0; break;
                    case '!=': boolResult = comparisonResult !== 0; break;
                }
                left = boolResult ? '真' : '假';
            }
            return left;
        }

        return parseComparison();
    },

    // 计算表达式（含变量替换）
    calculateExpression: function(expression) {
        try {
            var trimmed = expression.trim();
            if (!trimmed) return null;

            // 检查变量赋值: x = 100
            var assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
            if (assignMatch) {
                var varName = assignMatch[1];
                var varExpr = assignMatch[2];
                // 排除函数名和常数名
                var reservedNames = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'sqrt', 'abs', 'log', 'ln', 'factorial', 'nthRoot', 'e', 'pi', 'PI', 'Pi'];
                if (reservedNames.indexOf(varName) !== -1) {
                    return '错误：不能使用保留名称';
                }
                var varResult = this.calculateExpression(varExpr);
                if (varResult !== null && varResult !== '错误') {
                    this._variables[varName] = varResult;
                    return varName + ' = ' + varResult;
                }
                return '错误';
            }

            // 替换变量
            var cleaned = trimmed;
            var varNames = Object.keys(this._variables);
            // 按名称长度降序排列，避免短名称先替换导致问题
            varNames.sort(function(a, b) { return b.length - a.length; });
            for (var v = 0; v < varNames.length; v++) {
                var name = varNames[v];
                var val = this._variables[name];
                // 使用单词边界替换
                var re = new RegExp('\\b' + name + '\\b', 'g');
                cleaned = cleaned.replace(re, '(' + val + ')');
            }

            // 检查是否包含非数学字符
            var mathCharsRegex = /^[\d+\-*/^!%()\[\]{}<>.,=\sabcdefghijklmnopqrstuvwxyzπ,]+$/i;
            if (!mathCharsRegex.test(cleaned)) return null;

            // 处理比较操作符
            var opMap = [
                ['==', '__EQ__'], ['!=', '__NE__'],
                ['>=', '__GE__'], ['<=', '__LE__'],
                ['>', '__GT__'], ['<', '__LT__']
            ];
            for (var i = 0; i < opMap.length; i++) {
                cleaned = cleaned.replace(new RegExp(opMap[i][0], 'g'), opMap[i][1]);
            }
            cleaned = cleaned.replace(/=/g, '');
            for (var j = 0; j < opMap.length; j++) {
                cleaned = cleaned.replace(new RegExp(opMap[j][1], 'g'), opMap[j][0]);
            }

            cleaned = cleaned.replace(/\s+/g, '');
            if (!cleaned) return null;

            var tokens = this.tokenize(cleaned);
            if (tokens.length === 0) return null;

            var result = this.parseExpression(tokens);
            return result;
        } catch (error) {
            console.error('计算错误:', error);
            return '错误';
        }
    },

    // ========================================
    //   UI：计算卡片
    // ========================================

    // 创建计算卡片
    _createCalculatorCard: function(x, y) {
        var self = this;
        this._cardIdCounter++;
        var cardId = 'calc-card-' + this._cardIdCounter;

        // 默认位置：世界中心偏移
        if (x === undefined || y === undefined) {
            var center = this._world.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
            x = center.x - 150 + Math.random() * 60 - 30;
            y = center.y - 80 + Math.random() * 60 - 30;
        }

        var card = document.createElement('div');
        card.id = cardId;
        card.setAttribute('data-skill-id', 'calculator');
        card.setAttribute('data-cos-deletable', '');
        card.style.cssText =
            'position:absolute;' +
            'left:' + x + 'px;top:' + y + 'px;' +
            'width:300px;' +
            'background:rgba(15,25,50,0.95);' +
            'border:1px solid rgba(100,160,255,0.25);' +
            'border-radius:14px;' +
            'box-shadow:0 4px 20px rgba(0,0,0,0.4),inset 0 1px 0 rgba(100,160,255,0.1);' +
            'pointer-events:auto;' +
            'user-select:none;' +
            'z-index:50;' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            'overflow:hidden;';

        card.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;' +
            'padding:8px 12px;background:rgba(56,189,248,0.12);border-bottom:1px solid rgba(100,160,255,0.15);' +
            'cursor:grab;">' +
                '<span class="calc-title" style="color:#38bdf8;font-size:13px;font-weight:bold;">' + this._cards.length + 1 + '</span>' +
                '<div style="display:flex;gap:6px;">' +
                    '<button class="calc-help-btn" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.2);' +
                    'color:#38bdf8;border-radius:10px;padding:2px 8px;font-size:11px;cursor:pointer;transition:all 0.15s;">帮</button>' +
                    '<button class="calc-close-btn" style="background:rgba(220,80,60,0.2);border:1px solid rgba(220,80,60,0.3);' +
                    'color:#e87060;border-radius:10px;padding:2px 8px;font-size:11px;cursor:pointer;transition:all 0.15s;">关</button>' +
                '</div>' +
            '</div>' +
            '<div style="padding:10px 12px;">' +
                '<textarea class="calc-input" placeholder="输入表达式，如: 2^10 + sin(30)" ' +
                'style="width:100%;box-sizing:border-box;padding:8px 10px;min-height:60px;resize:vertical;' +
                'background:rgba(10,18,35,0.8);border:1px solid rgba(100,160,255,0.2);' +
                'border-radius:10px;color:#e8edf5;font-size:14px;outline:none;' +
                'font-family:"Courier New",monospace;transition:border-color 0.2s;line-height:1.5;"></textarea>' +
                '<div class="calc-result" style="margin-top:8px;padding:8px 10px;min-height:40px;max-height:120px;overflow-y:auto;' +
                'background:rgba(10,18,35,0.6);border-radius:10px;color:#a0e8a0;font-size:15px;' +
                'font-family:"Courier New",monospace;word-break:break-all;cursor:pointer;' +
                'transition:background 0.2s;" title="点击复制结果"></div>' +
                '<div class="calc-vars" style="margin-top:6px;font-size:11px;color:#94a3b8;max-height:60px;overflow-y:auto;"></div>' +
            '</div>';

        this._layer.appendChild(card);
        this._cards.push(card);

        // 让卡片可拖拽
        this._makeDraggable(card, card.querySelector('div'));

        // 输入框事件
        var input = card.querySelector('.calc-input');
        var resultDiv = card.querySelector('.calc-result');
        var varsDiv = card.querySelector('.calc-vars');

        input.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        input.addEventListener('wheel', function(e) {
            e.stopPropagation();
        });

        // 输入框聚焦样式
        input.addEventListener('focus', function() {
            this.style.borderColor = 'rgba(56,189,248,0.5)';
        });
        input.addEventListener('blur', function() {
            this.style.borderColor = 'rgba(100,160,255,0.2)';
        });

        // 实时计算
        input.addEventListener('input', function() {
            self._evaluateInput(this);
            self._updateVarsDisplay(varsDiv);
        });

        // Shift+Enter 确认计算，普通回车换行
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                self._evaluateInput(this);
                self._updateVarsDisplay(varsDiv);
            }
        });

        // 点击结果复制
        resultDiv.addEventListener('click', function() {
            var text = this.textContent.replace('= ', '');
            if (!text || text === '...') return;
            navigator.clipboard.writeText(text).then(function() {
                var orig = resultDiv.style.background;
                resultDiv.style.background = 'rgba(56,189,248,0.2)';
                resultDiv.textContent = '已复制!';
                setTimeout(function() {
                    resultDiv.style.background = orig;
                    resultDiv.textContent = '= ' + text;
                }, 800);
            });
        });

        // 帮助按钮
        card.querySelector('.calc-help-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            self._showHelpDialog();
        });

        // 关闭按钮
        card.querySelector('.calc-close-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            if (card._cleanup) card._cleanup();
            if (card.parentNode) card.parentNode.removeChild(card);
            var idx = self._cards.indexOf(card);
            if (idx !== -1) self._cards.splice(idx, 1);
            // 重新编号所有卡片
            self._cards.forEach(function(c, i) {
                var titleEl = c.querySelector('.calc-title');
                if (titleEl) titleEl.textContent = i + 1;
            });
            // 没有卡片了，清空变量
            if (self._cards.length === 0) self._variables = {};
        });

        // 标记内容区域
        this._world.markContent(x, y, 300, 160);

        return card;
    },

    // 评估输入框内容（支持多行）
    _evaluateInput: function(inputEl) {
        var card = inputEl.closest('[id^="calc-card"]');
        if (!card) return;
        var resultDiv = card.querySelector('.calc-result');
        var text = inputEl.value.trim();

        if (!text) {
            resultDiv.textContent = '...';
            resultDiv.style.color = '#94a3b8';
            return;
        }

        var lines = text.split('\n');
        var results = [];
        var hasError = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var result = this.calculateExpression(line);
            if (result === null) continue;
            if (result === '错误' || result.indexOf('错误') === 0) {
                results.push('  ' + result);
                hasError = true;
            } else {
                results.push('  = ' + result);
            }
        }

        if (results.length === 0) {
            resultDiv.textContent = '...';
            resultDiv.style.color = '#94a3b8';
        } else {
            resultDiv.textContent = results.join('\n');
            resultDiv.style.color = hasError ? '#e8a060' : '#a0e8a0';
            resultDiv.style.whiteSpace = 'pre';
        }
    },

    // 更新变量显示
    _updateVarsDisplay: function(varsDiv) {
        var keys = Object.keys(this._variables);
        if (keys.length === 0) {
            varsDiv.textContent = '';
            return;
        }
        var lines = [];
        for (var i = 0; i < keys.length; i++) {
            lines.push(keys[i] + ' = ' + this._variables[keys[i]]);
        }
        varsDiv.textContent = '变量: ' + lines.join('  |  ');
    },

    // 让元素可在世界中拖拽
    _makeDraggable: function(el, handle) {
        var self = this;
        var isDragging = false;
        var startX, startY, origX, origY;

        var onHandleDown = function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.button !== 0) return;
            // 只处理这个卡片的事件
            if (!e.target.closest('#' + el.id)) return;
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = parseInt(el.style.left) || 0;
            origY = parseInt(el.style.top) || 0;
            handle.style.cursor = 'grabbing';
        };
        document.addEventListener('mousedown', onHandleDown, true);

        var onMove = function(data) {
            if (!isDragging) return;
            var worldStart = self._world.screenToWorld(startX, startY);
            var worldNow = self._world.screenToWorld(data.screenX, data.screenY);
            var newX = origX + (worldNow.x - worldStart.x);
            var newY = origY + (worldNow.y - worldStart.y);
            el.style.left = newX + 'px';
            el.style.top = newY + 'px';
        };

        var onUp = function() {
            if (!isDragging) return;
            isDragging = false;
            handle.style.cursor = 'grab';
        };

        this._world.on('mousemove', onMove);
        this._world.on('mouseup', onUp);

        el._cleanup = function() {
            document.removeEventListener('mousedown', onHandleDown, true);
            self._world.off('mousemove', onMove);
            self._world.off('mouseup', onUp);
        };
    },

    // ========================================
    //   帮助对话框
    // ========================================

    _showHelpDialog: function() {
        // 如果已存在则移除
        var existing = document.getElementById('calc-help-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'calc-help-overlay';
        overlay.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.6);z-index:9999;' +
            'display:flex;align-items:center;justify-content:center;';

        var dialog = document.createElement('div');
        dialog.style.cssText =
            'background:rgba(15,25,50,0.98);border:1px solid rgba(100,160,255,0.3);' +
            'border-radius:14px;padding:24px;max-width:560px;width:90%;' +
            'max-height:80vh;overflow-y:auto;color:#e8edf5;font-size:13px;' +
            'box-shadow:0 8px 40px rgba(0,0,0,0.5);' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

        dialog.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                '<h2 style="margin:0;color:#38bdf8;font-size:18px;">🧮 计算器帮助</h2>' +
                '<button id="calc-help-close" style="background:rgba(56,189,248,0.2);border:1px solid rgba(56,189,248,0.3);' +
                'color:#38bdf8;border-radius:10px;padding:4px 12px;cursor:pointer;font-size:13px;transition:all 0.15s;">关闭</button>' +
            '</div>' +

            '<div style="margin-bottom:16px;">' +
                '<h3 style="color:#38bdf8;margin:0 0 8px 0;font-size:14px;">基本运算符</h3>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;">' +
                    '<div><code style="color:#a0e8a0;">+</code> 加法 (1+2)</div>' +
                    '<div><code style="color:#a0e8a0;">-</code> 减法 (3-1)</div>' +
                    '<div><code style="color:#a0e8a0;">*</code> 乘法 (2*3)</div>' +
                    '<div><code style="color:#a0e8a0;">/</code> 除法 (6/2)</div>' +
                    '<div><code style="color:#a0e8a0;">^</code> 幂运算 (2^3=8)</div>' +
                    '<div><code style="color:#a0e8a0;">%</code> 求余 (7%3=1)</div>' +
                    '<div><code style="color:#a0e8a0;">!</code> 阶乘 (5!=120)</div>' +
                '</div>' +
            '</div>' +

            '<div style="margin-bottom:16px;">' +
                '<h3 style="color:#38bdf8;margin:0 0 8px 0;font-size:14px;">比较运算符</h3>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;">' +
                    '<div><code style="color:#a0e8a0;">==</code> 等于</div>' +
                    '<div><code style="color:#a0e8a0;">!=</code> 不等于</div>' +
                    '<div><code style="color:#a0e8a0;">></code> 大于</div>' +
                    '<div><code style="color:#a0e8a0;"><</code> 小于</div>' +
                    '<div><code style="color:#a0e8a0;">>=</code> 大于等于</div>' +
                    '<div><code style="color:#a0e8a0;"><=</code> 小于等于</div>' +
                '</div>' +
            '</div>' +

            '<div style="margin-bottom:16px;">' +
                '<h3 style="color:#38bdf8;margin:0 0 8px 0;font-size:14px;">数学函数</h3>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;">' +
                    '<div><code style="color:#80c8f0;">sin(x)</code> 正弦(角度制)</div>' +
                    '<div><code style="color:#80c8f0;">cos(x)</code> 余弦(角度制)</div>' +
                    '<div><code style="color:#80c8f0;">tan(x)</code> 正切(角度制)</div>' +
                    '<div><code style="color:#80c8f0;">csc(x)</code> 余割</div>' +
                    '<div><code style="color:#80c8f0;">sec(x)</code> 正割</div>' +
                    '<div><code style="color:#80c8f0;">cot(x)</code> 余切</div>' +
                    '<div><code style="color:#80c8f0;">sqrt(x)</code> 平方根</div>' +
                    '<div><code style="color:#80c8f0;">abs(x)</code> 绝对值</div>' +
                    '<div><code style="color:#80c8f0;">log(x,b)</code> 对数(默认底10)</div>' +
                    '<div><code style="color:#80c8f0;">ln(x)</code> 自然对数</div>' +
                    '<div><code style="color:#80c8f0;">nthRoot(x,n)</code> n次根</div>' +
                    '<div><code style="color:#80c8f0;">factorial(x)</code> 阶乘</div>' +
                '</div>' +
            '</div>' +

            '<div style="margin-bottom:16px;">' +
                '<h3 style="color:#38bdf8;margin:0 0 8px 0;font-size:14px;">常数</h3>' +
                '<div><code style="color:#38bdf8;">e</code> 自然常数 (~2.71828)　　<code style="color:#38bdf8;">pi</code> 圆周率 (~3.14159)</div>' +
            '</div>' +

            '<div style="margin-bottom:16px;">' +
                '<h3 style="color:#38bdf8;margin:0 0 8px 0;font-size:14px;">变量赋值</h3>' +
                '<div style="background:rgba(10,18,35,0.6);padding:10px;border-radius:10px;font-family:monospace;">' +
                    '<div><code style="color:#a0e8a0;">x = 100</code></div>' +
                    '<div><code style="color:#a0e8a0;">y = x * 2</code></div>' +
                    '<div><code style="color:#a0e8a0;">result = sin(45) + y</code></div>' +
                '</div>' +
            '</div>' +

            '<div>' +
                '<h3 style="color:#38bdf8;margin:0 0 8px 0;font-size:14px;">使用示例</h3>' +
                '<div style="background:rgba(10,18,35,0.6);padding:10px;border-radius:10px;font-family:monospace;">' +
                    '<div><code style="color:#e8edf5;">1+2*3</code> <span style="color:#94a3b8;">= 7</span></div>' +
                    '<div><code style="color:#e8edf5;">(1+2)*3</code> <span style="color:#94a3b8;">= 9</span></div>' +
                    '<div><code style="color:#e8edf5;">sin(30)</code> <span style="color:#94a3b8;">= 0.5</span></div>' +
                    '<div><code style="color:#e8edf5;">2^10+4</code> <span style="color:#94a3b8;">= 1028</span></div>' +
                    '<div><code style="color:#e8edf5;">5!-10</code> <span style="color:#94a3b8;">= 110</span></div>' +
                '</div>' +
            '</div>';

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 关闭按钮
        document.getElementById('calc-help-close').addEventListener('click', function() {
            overlay.remove();
        });

        // 点击遮罩关闭
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
    }
};
