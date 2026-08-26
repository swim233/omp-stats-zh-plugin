import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const LOCAL_HOST = "127.0.0.1";
const configuredPort = Number(process.env.OMP_STATS_ZH_PORT);
const LOCAL_PORT = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65_535 ? configuredPort : 3947;
const DEFAULT_UPSTREAM = "http://127.0.0.1:3847";
const PUBLIC_URL = `http://localhost:${LOCAL_PORT}`;
const HEALTH_PATH = "/__stats_zh_health";
const TRANSLATION_PATH = "/stats-zh.js";

interface ProxyServer {
	port: number;
	stop(closeActiveConnections?: boolean): void;
}

interface UpstreamProcess {
	kill(): void;
}

let proxyServer: ProxyServer | undefined;
let upstreamUrl: string | undefined;
let ownedUpstreamProcess: UpstreamProcess | undefined;
let startPromise: Promise<void> | undefined;

const translations: Record<string, string> = {
	"AI Usage Statistics": "AI 使用统计",
	"Observability": "可观测性",
	"OBSERVABILITY": "可观测性",
	"Overview": "概览",
	"Requests": "请求",
	"Errors": "错误",
	"Models": "模型",
	"Providers": "提供商",
	"Tools": "工具",
	"Costs": "费用",
	"Behavior": "行为",
	"API-equivalent estimate": "API 等效费用估算",
	"Average estimate / Day": "日均 API 等效费用估算",
	"Daily API-equivalent estimate": "每日 API 等效费用估算",
	"Public API rate-card value over time": "按公共 API 价目表估算的费用趋势",
	"No API-equivalent estimate data available": "暂无 API 等效费用估算数据",
	"Efficiency": "效率",
	"N/A": "不适用",
	"Projects": "项目",
	"Gain": "收益",
	"All": "全部",
	"All Models": "全部模型",
	"All providers": "全部提供商",
	"All tools": "全部工具",
	"Sync DB": "同步数据库",
	"System theme (click to switch)": "跟随系统主题（点击切换）",
	"Light theme (click to switch)": "浅色主题（点击切换）",
	"Dark theme (click to switch)": "深色主题（点击切换）",
	"System theme — click to switch": "跟随系统主题——点击切换",
	"Light theme — click to switch": "浅色主题——点击切换",
	"Dark theme — click to switch": "深色主题——点击切换",
	"Navigation menu": "导航菜单",
	"Close navigation menu": "关闭导航菜单",
	"Open navigation menu": "打开导航菜单",
	"Select time range": "选择时间范围",
	"No data available": "暂无数据",
	"No friction signal data available": "暂无摩擦信号数据",
	"Failed to load data": "数据加载失败",
	"Retry": "重试",
	"less than a minute ago": "不到 1 分钟前",
	"TOTAL COST": "总费用",
	"REQUESTS": "请求数",
	"CACHE RATE": "缓存命中率",
	"ERROR RATE": "错误率",
	"Cache Savings": "缓存节省率",
	"Cache savings": "缓存节省率",
	"Prompt-input cost saved versus billing the same tokens uncached; cache writes can make this negative": "与相同 Token 全部按未缓存输入计费相比节省的提示词输入费用；缓存写入可能使该值为负",
	"Prompt input served from cache: cache reads / (uncached input + cache reads)": "从缓存读取的提示词输入占比：缓存读取 /（未缓存输入 + 缓存读取）",
	"Conversation input not served from cache": "未从缓存提供的对话输入",
	"Conversation input read from the prompt cache": "从提示词缓存读取的对话输入",
	"Uncached input + cache reads + cache writes + output": "未缓存输入 + 缓存读取 + 缓存写入 + 输出",
	"UNCACHED INPUT": "未缓存输入",
	"CACHE READ": "缓存读取",
	"OUTPUT TOKENS": "输出 Token",
	"CONVERSATION TOTAL": "对话 Token 总量",
	"PREMIUM REQUESTS": "高级请求",
	"TOKENS/S": "Token/秒",
	"TOK/S": "Token/秒",
	"AVG LATENCY": "平均延迟",
	"AVG TTFT": "平均首字延迟",
	"Conversation Tokens by Agent": "按智能体类型统计对话 Token",
	"Uncached input + cache reads + cache writes + output, grouped by agent type": "按智能体类型汇总未缓存输入、缓存读取、缓存写入和输出 Token",
	"Main agent": "主智能体",
	"Subagents": "子智能体",
	"System Throughput": "系统吞吐量",
	"Request volume and errors over time": "请求量和错误数随时间的变化",
	"Operational Feed": "运行动态",
	"Real-time request log": "实时请求日志",
	"Recent Requests Preview": "近期请求预览",
	"Latest transactions processed by the proxy": "代理最近处理的请求",
	"View All Requests": "查看全部请求",
	"All Recent Requests": "全部近期请求",
	"Up to 50 most recent requests processed by OMP": "OMP 最近处理的最多 50 个请求",
	"Recent Errors": "近期错误",
	"Up to 50 most recent failed requests in the stats database": "统计数据库中最近失败的最多 50 个请求",
	"Request details": "请求详情",
	"Request Details": "请求详情",
	"Close request details": "关闭请求详情",
	"Failed to load request details": "请求详情加载失败",
	"Output Payload": "输出载荷",
	"Raw Request Metadata": "原始请求元数据",
	"Error": "错误",
	"Premium": "高级请求",
	"Total Tokens": "Token 总量",
	"Throughput": "吞吐量",
	"tokens/second": "Token/秒",
	"Copied to clipboard": "已复制到剪贴板",
	"Copy JSON to clipboard": "将 JSON 复制到剪贴板",
	"Copied": "已复制",
	"Copy": "复制",
	"▶ Show": "▶ 展开",
	"▼ Hide": "▼ 收起",
	"MODEL": "模型",
	"TIME": "时间",
	"TOKENS": "Token",
	"COST": "费用",
	"DURATION": "耗时",
	"STATUS": "状态",
	"ERROR MESSAGE": "错误信息",
	"Success": "成功",
	"Failed": "失败",
	"Failure": "失败",
	"AVERAGE / DAY": "日均费用",
	"TOP MODEL": "费用最高的模型",
	"Daily Cost": "每日费用",
	"API spending over time": "API 费用随时间的变化",
	"By Model": "按模型",
	"Model Preference": "模型偏好",
	"Share of requests over the last 24 hours": "过去 24 小时各模型的请求占比",
	"Model Statistics": "模型统计",
	"24H TREND": "24 小时趋势",
	"TTFT": "首字延迟",
	"Provider Totals": "提供商汇总",
	"Token, request, and cost totals per provider over the active range": "当前时间范围内各提供商的 Token、请求和费用汇总",
	"Token, request, and API-equivalent estimates over the active range": "当前时间范围内各提供商的 Token、请求和 API 等效费用估算汇总",
	"PROVIDER": "提供商",
	"SHARE": "占比",
	"Burn by Provider": "按提供商统计消耗",
	"Stacked token/cost burn per provider over time": "各提供商 Token 与费用消耗随时间的堆叠趋势",
	"Stacked token or API-equivalent estimate burn over time": "Token 或 API 等效费用估算随时间的堆叠消耗趋势",
	"Tokens": "Token",
	"Cost": "费用",
	"Peak Burn Hours": "消耗高峰时段",
	"Subscription Windows": "订阅额度窗口",
	"What each usage window buys you, and how many accounts peak demand needs": "各额度窗口可用量及满足峰值需求所需的账号数",
	"WINDOW": "窗口",
	"ACCOUNTS": "账号数",
	"WINDOWS BURNED": "已消耗窗口数",
	"EST. TOKENS / WINDOW": "每窗口预计 Token",
	"PEAK UTILIZATION": "峰值利用率",
	"IDEAL ACCOUNTS": "理想账号数",
	"EXHAUSTIONS": "耗尽次数",
	"Window Utilization": "窗口利用率",
	"Latest recorded limit utilization per account and window — red bars are exhausted, amber above 80%": "各账号与窗口最近记录的额度利用率——红色表示已耗尽，琥珀色表示超过 80%",
	"Subscription-window equivalents consumed in range (sum of used-fraction increases across accounts)": "当前范围内消耗的订阅窗口等值数（各账号已用比例增量之和）",
	"Provider tokens burned in range ÷ windows burned — what one full window is worth": "当前范围内提供商消耗的 Token ÷ 已消耗窗口数——一个完整窗口对应的 Token 量",
	"Peak of summed used fraction across accounts at any sampled instant": "任一采样时刻各账号已用比例之和的峰值",
	"Accounts needed to keep peak demand under 90% of fleet capacity": "将峰值需求控制在账号池容量 90% 以下所需的账号数",
	"No usage snapshots recorded yet — they accumulate whenever usage is fetched (TUI footer, /usage, omp usage)": "暂无用量快照——每次获取用量时都会累积记录（TUI 底栏、/usage、omp usage）",
	"Used": "已使用",
	"Tool Usage": "工具使用情况",
	"Tokens/cost are the invoking turns' real provider usage, split across each turn's tool calls": "Token 与费用取自调用轮次的真实提供商用量，并分摊到该轮的各次工具调用",
	"Tokens and API-equivalent estimates are split from invoking turns across each turn's tool calls": "调用轮次的 Token 和 API 等效费用估算会分摊到该轮的各次工具调用",
	"TOOL CALLS": "工具调用数",
	"TOOLS USED": "已使用工具数",
	"ATTRIBUTED COST": "归因费用",
	"Attributed API-equivalent estimate": "归因 API 等效费用估算",
	"ATTRIBUTED TOKENS": "归因 Token",
	"ATTRIBUTED OUTPUT": "归因输出 Token",
	"RESULT TEXT": "结果文本",
	"CALL ARGUMENTS": "调用参数",
	"Calls Over Time": "调用趋势",
	"Tool calls over the last 24 hours, stacked by tool": "过去 24 小时各工具调用量的堆叠趋势",
	"By Tool": "按工具",
	"Usage per tool, most called first": "各工具使用情况，按调用量降序排列",
	"TOOL": "工具",
	"CALLS": "调用数",
	"ATTR. TOKENS": "归因 Token",
	"ATTR. COST": "归因费用",
	"ATTR. API-EQUIVALENT ESTIMATE": "归因 API 等效费用估算",
	"Attr. API-equivalent estimate": "归因 API 等效费用估算",
	"LAST USED": "最近使用",
	"Which models call which tools": "各模型调用工具的情况",
	"Invoking turns' total tokens, split across each turn's calls": "调用轮次的 Token 总量，并分摊到该轮的各次调用",
	"Characters of tool-result text fed back into context": "回填到上下文的工具结果文本字符数",
	"Err": "错误",
	"User Messages": "用户消息",
	"in range": "当前范围内",
	"Yelling (CAPS)": "大写喊叫",
	"Profanity Hits": "粗俗用语命中",
	"Anguish Signals": "痛苦信号",
	"Friction Signals": "摩擦信号",
	"Highest Friction Model": "摩擦度最高的模型",
	"User Friction Signals": "用户摩擦信号",
	"All signals combined as % of user messages per day": "每日所有信号合计占用户消息的百分比",
	"CAPS": "大写",
	"Profanity": "粗俗用语",
	"Anguish": "痛苦",
	"Negation": "否定",
	"Repetition": "重复",
	"Blame": "责备",
	"Frustration": "挫败",
	"Behavior Signals by Model": "按模型统计行为信号",
	"Rates are per user message": "比率按每条用户消息计算",
	"Profanity as % of user messages per day": "每日粗俗用语信号占用户消息的百分比",
	"Anguish as % of user messages per day": "每日痛苦信号占用户消息的百分比",
	"Negation as % of user messages per day": "每日否定信号占用户消息的百分比",
	"Repetition as % of user messages per day": "每日重复信号占用户消息的百分比",
	"Blame as % of user messages per day": "每日责备信号占用户消息的百分比",
	"Frustration as % of user messages per day": "每日挫败信号占用户消息的百分比",
	"Anguish (!!!, nooo, ugh, dude, ':(')": "痛苦（!!!、nooo、ugh、dude、':('）",
	"Negation (no/nope/wrong, makes no sense)": "否定（no/nope/wrong、makes no sense）",
	"Repetition (i meant, still doesnt)": "重复（i meant、still doesnt）",
	"Blame (you didnt, why did you, stop X-ing)": "责备（you didnt、why did you、stop X-ing）",
	"Frustration (neg + rep + blame)": "挫败（否定 + 重复 + 责备）",
	"All signals combined": "所有信号合计",
	"Anguish (!!!, nooo, dude, ..)": "痛苦（!!!、nooo、dude、..）",
	"Negation (no/nope/wrong)": "否定（no/nope/wrong）",
	"Blame (you didnt, stop X-ing)": "责备（you didnt、stop X-ing）",
	"Avg chars / msg": "平均字符数/条消息",
	"MESSAGES": "消息数",
	"CAPS %": "大写占比",
	"PROFANITY %": "粗俗用语占比",
	"ANGUISH %": "痛苦信号占比",
	"FRUSTRATION %": "挫败信号占比",
	"HITS %": "命中率",
	"TREND": "趋势",
	"Projects & Folders": "项目与文件夹",
	"Aggregate proxy metrics grouped by folder path": "按文件夹路径汇总代理指标",
	"PROJECT/FOLDER": "项目/文件夹",
	"AVG DURATION": "平均耗时",
	"Overall Gain": "总体收益",
	"Aggregate snapcompact savings": "汇总 snapcompact 节省量",
	"SAVED TOKENS": "节省的 Token",
	"SAVED BYTES": "节省的字节数",
	"REDUCTION": "缩减率",
	"TOTAL HITS": "总命中次数",
	"By Source": "按来源",
	"Savings breakdown per subsystem": "按子系统拆分节省量",
	"HITS": "命中次数",
	"Savings Over Time": "节省趋势",
	"Daily token savings": "每日 Token 节省量",
	"No time series data yet": "暂无时间序列数据",
	"Project": "项目",
	"All projects": "全部项目",
	"(unknown)": "（未知）",
	"所有信号合计 as % of user messages per day": "每日所有信号合计占用户消息的百分比",
	"Total Cost": "总费用",
	"Cache Rate": "缓存命中率",
	"Error Rate": "错误率",
	"Uncached Input": "未缓存输入",
	"Cache Read": "缓存读取",
	"Output Tokens": "输出 Token",
	"Conversation Total": "对话 Token 总量",
	"Premium Requests": "高级请求",
	"Tokens/s": "Token/秒",
	"Avg Latency": "平均延迟",
	"Avg TTFT": "平均首字延迟",
	"Average / Day": "日均费用",
	"Top Model": "费用最高的模型",
	"Total spent:": "总支出：",
	"Model": "模型",
	"Time": "时间",
	"Token": "Token",
	"Duration": "耗时",
	"Status": "状态",
	"Error Message": "错误信息",
	"Provider": "提供商",
	"Share": "占比",
	"Window": "窗口",
	"Accounts": "账号数",
	"Windows Burned": "已消耗窗口数",
	"Est. Tokens / Window": "每窗口预计 Token",
	"Peak Utilization": "峰值利用率",
	"Ideal Accounts": "理想账号数",
	"Exhaustions": "耗尽次数",
	"Tool Calls": "工具调用数",
	"Tools Used": "已使用工具数",
	"Attributed Cost": "归因费用",
	"Attributed Tokens": "归因 Token",
	"Attributed Output": "归因输出 Token",
	"Result Text": "结果文本",
	"Call Arguments": "调用参数",
	"Tool": "工具",
	"Calls": "调用数",
	"Attr. Tokens": "归因 Token",
	"Attr. Cost": "归因费用",
	"Last Used": "最近使用",
	"Messages": "消息数",
	"Profanity %": "粗俗用语占比",
	"Anguish %": "痛苦信号占比",
	"Frustration %": "挫败信号占比",
	"Hits %": "命中率",
	"Trend": "趋势",
	"Project/Folder": "项目/文件夹",
	"Avg Duration": "平均耗时",
	"Saved Tokens": "节省的 Token",
	"Saved Bytes": "节省的字节数",
	"Reduction": "缩减率",
	"Total Hits": "总命中次数",
	"Hits": "命中次数",
	"Snapcompact": "快照压缩",
	"req": "次请求",
	"tok": "Token",
	"chars": "字符",
	"msg": "条消息",
	"24h Trend": "24 小时趋势",
	"Tok/s": "Token/秒",
	"/ msg": "/ 条消息",
};

const translationScript = String.raw`(() => {
  const exact = ${JSON.stringify(translations)};
  const rules = [
    [/^Updated (.+)$/i, "更新于 $1"],
    [/^about (\d+) seconds? ago$/i, "约 $1 秒前"],
    [/^(\d+) seconds? ago$/i, "$1 秒前"],
    [/^about (\d+) minutes? ago$/i, "约 $1 分钟前"],
    [/^(\d+) minutes? ago$/i, "$1 分钟前"],
    [/^about (\d+) hours? ago$/i, "约 $1 小时前"],
    [/^(\d+) hours? ago$/i, "$1 小时前"],
    [/^about (\d+) days? ago$/i, "约 $1 天前"],
    [/^(\d+) days? ago$/i, "$1 天前"],
    [/^(\d+) days?$/i, "$1 天"],
    [/^(\d+) hours?$/i, "$1 小时"],
    [/^(\d+(?:\.\d+)?) req$/i, "$1 次请求"],
    [/^(\d+(?:\.\d+)?(?:[KMB]|万|亿)?) tok$/i, "$1 Token"],
    [/^(\d+(?:\.\d+)?(?:[KMB]|万|亿)?) chars$/i, "$1 字符"],
    [/^(\d+(?:\.\d+)?) hits?$/i, "$1 次命中"],
    [/^(.+) \/ msg$/i, "$1 / 条消息"],
    [/^(.+) in · (.+) out$/i, "$1 输入 · $2 输出"],
    [/^in ·$/i, "输入 ·"],
    [/^out$/i, "输出"],
    [/^\(have (\d+)\)$/i, "（现有 $1 个）"],
    [/^Input (.+) · Output (.+) · Cache read (.+) · Cache write (.+)$/i, "输入 $1 · 输出 $2 · 缓存读取 $3 · 缓存写入 $4"],
    [/^(.+) as % of user messages per day$/i, "每日$1信号占用户消息的百分比"],
    [/^unknown$/i, "未知"],
    [/^Total spent: (.+)$/i, "总支出：$1"],
    [/^Share of requests over the last (\d+) hours$/i, "过去 $1 小时各模型的请求占比"],
    [/^Share of requests over the last (\d+) days$/i, "过去 $1 天各模型的请求占比"],
    [/^Tool calls over the last (\d+) hours, stacked by tool$/i, "过去 $1 小时各工具调用量的堆叠趋势"],
    [/^Tool calls over the last (\d+) days, stacked by tool$/i, "过去 $1 天各工具调用量的堆叠趋势"],
    [/^Token burn by local hour of day — peak at (.+)$/i, "按本地时段统计 Token 消耗——峰值在 $1"],
    [/^Excludes (\d[\d,]*) unpriced subscription requests?$/i, "不含 $1 次未定价订阅请求"],
    [/^API-equivalent estimate: (.+)$/i, "API 等效费用估算：$1"],
    [/^Public API rate-card value over time; excludes (\d[\d,]*) unpriced subscription requests?$/i, "按公共 API 价目表估算的费用趋势；不含 $1 次未定价订阅请求"],
    [/^Token, request, and API-equivalent estimates; excludes (\d[\d,]*) unpriced subscription requests?$/i, "Token、请求和 API 等效费用估算；不含 $1 次未定价订阅请求"],
    [/^API-equivalent estimates over time; excludes (\d[\d,]*) unpriced subscription requests?$/i, "API 等效费用估算趋势；不含 $1 次未定价订阅请求"],
  ];

  function translate(value) {
    if (!value) return value;
    const match = value.match(/^(\s*)(.*?)(\s*)$/s);
    if (!match || !match[2]) return value;
    const [, before, core, after] = match;
    let result;
    const compactNumber = core.match(/^(-?\d+(?:\.\d+)?)(万|亿)(.*)$/);
    if (compactNumber) {
      const absolute = Number(compactNumber[1]) * (compactNumber[2] === "亿" ? 100_000_000 : 10_000);
      const divisor = absolute >= 1_000_000_000 ? 1_000_000_000 : absolute >= 1_000_000 ? 1_000_000 : 1_000;
      const unit = divisor === 1_000_000_000 ? "B" : divisor === 1_000_000 ? "M" : "K";
      const amount = (absolute / divisor).toFixed(1);
      const suffix = compactNumber[3].replace(/\btok\b/i, "Token").replace(/\bchars\b/i, "字符");
      result = amount + unit + suffix;
    } else {
      result = exact[core];
    }
    if (!result) {
      for (const [pattern, replacement] of rules) {
        if (pattern.test(core)) {
          result = core.replace(pattern, replacement);
          break;
        }
      }
    }
    return result ? before + result + after : value;
  }

  function translateElement(element) {
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      const value = element.getAttribute(attribute);
      if (value) {
        const translated = translate(value);
        if (translated !== value) element.setAttribute(attribute, translated);
      }
    }
  }

  function translateTree(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName)) return;
      const translated = translate(root.nodeValue || "");
      if (translated !== root.nodeValue) root.nodeValue = translated;
      return;
    }
    if (!(root instanceof Element || root instanceof Document)) return;
    if (root instanceof Element) translateElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName)) continue;
        const translated = translate(node.nodeValue || "");
        if (translated !== node.nodeValue) node.nodeValue = translated;
      } else if (node instanceof Element) {
        translateElement(node);
      }
    }
  }

  document.documentElement.lang = "zh-CN";
  document.title = "OMP AI 使用统计";
  translateTree(document);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") translateTree(record.target);
      for (const node of record.addedNodes) translateTree(node);
      if (record.type === "attributes") translateTree(record.target);
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "placeholder"],
  });
})();`;

function patchBundle(source: string): string {
	let patched = source;
	patched = patched.replace(
		/\.toLocaleString\(\s*(?:void 0|undefined)\s*,\s*\{\s*notation\s*:\s*["']compact["']\s*\}\s*\)/g,
		'.toLocaleString("en-US",{notation:"compact",minimumFractionDigits:1,maximumFractionDigits:1})',
	);
	for (const [english, chinese] of Object.entries(translations)) {
		patched = patched.replaceAll(JSON.stringify(english), JSON.stringify(chinese));
	}
	return patched;
}

async function isStatsDashboard(url: string): Promise<boolean> {
	try {
		const response = await fetch(`${url}/`, { signal: AbortSignal.timeout(1_500) });
		if (!response.ok) return false;
		const html = await response.text();
		return html.includes("<div id=\"root\"></div>") && html.includes("index.js");
	} catch {
		return false;
	}
}

async function readDashboardUrl(
	stdout: ReadableStream<Uint8Array>,
	stderr: ReadableStream<Uint8Array>,
	exited: Promise<number>,
): Promise<string> {
	const reader = stdout.getReader();
	const decoder = new TextDecoder();
	let output = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			const exitCode = await exited;
			const errorOutput = (await new Response(stderr).text()).trim();
			throw new Error(`Stats 后端退出，状态码 ${exitCode}${errorOutput ? `：${errorOutput}` : ""}`);
		}
		output += decoder.decode(value, { stream: true });
		const match = output.match(/Dashboard available at:\s+(https?:\/\/\S+)/);
		if (match?.[1]) {
			reader.releaseLock();
			return match[1];
		}
		if (output.length > 16_384) output = output.slice(-16_384);
	}
}

async function waitForDashboardUrl(
	stdout: ReadableStream<Uint8Array>,
	stderr: ReadableStream<Uint8Array>,
	exited: Promise<number>,
): Promise<string> {
	const timeout = Promise.withResolvers<string>();
	const timer = setTimeout(() => timeout.reject(new Error("Stats 后端启动超时")), 120_000);
	try {
		return await Promise.race([readDashboardUrl(stdout, stderr, exited), timeout.promise]);
	} finally {
		clearTimeout(timer);
	}
}

async function startFallbackUpstream(): Promise<string> {
	const bunPath = Bun.which("bun");
	if (!bunPath) throw new Error("未找到 Bun 可执行文件");
	const candidates = [
		fileURLToPath(new URL("../node_modules/@oh-my-pi/omp-stats/src/index.ts", import.meta.url)),
		fileURLToPath(new URL("../../@oh-my-pi/omp-stats/src/index.ts", import.meta.url)),
	];
	let statsEntry: string | undefined;
	for (const candidate of candidates) {
		if (await Bun.file(candidate).exists()) {
			statsEntry = candidate;
			break;
		}
	}
	if (!statsEntry) throw new Error("未找到 @oh-my-pi/omp-stats 安装目录");
	const child = Bun.spawn([bunPath, statsEntry, "--port", "0", "--host", LOCAL_HOST], {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	ownedUpstreamProcess = child;
	try {
		return await waitForDashboardUrl(child.stdout, child.stderr, child.exited);
	} catch (error) {
		child.kill();
		await child.exited;
		ownedUpstreamProcess = undefined;
		throw error;
	}
}

async function resolveUpstream(): Promise<string> {
	if (upstreamUrl && (await isStatsDashboard(upstreamUrl))) return upstreamUrl;
	if (await isStatsDashboard(DEFAULT_UPSTREAM)) return DEFAULT_UPSTREAM;
	return startFallbackUpstream();
}

function injectTranslation(html: string): string {
	return html
		.replace('<html lang="en">', '<html lang="zh-CN">')
		.replace("<title>AI Usage Statistics</title>", "<title>OMP AI 使用统计</title>")
		.replace("</body>", `    <script src="${TRANSLATION_PATH}"></script>\n</body>`);
}

async function proxyRequest(request: Request): Promise<Response> {
	const incomingUrl = new URL(request.url);
	if (incomingUrl.pathname === HEALTH_PATH) {
		return Response.json({ ok: true, upstream: upstreamUrl });
	}
	if (incomingUrl.pathname === TRANSLATION_PATH) {
		return new Response(translationScript, {
			headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" },
		});
	}
	if (!upstreamUrl) return new Response("Stats 中文代理尚未就绪", { status: 503 });

	const target = new URL(incomingUrl.pathname + incomingUrl.search, upstreamUrl);
	const requestHeaders = new Headers(request.headers);
	requestHeaders.delete("host");
	requestHeaders.delete("content-length");
	requestHeaders.delete("accept-encoding");
	const upstreamResponse = await fetch(target, {
		method: request.method,
		headers: requestHeaders,
		body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
		redirect: "manual",
	});
	const responseHeaders = new Headers(upstreamResponse.headers);
	responseHeaders.delete("content-length");
	responseHeaders.delete("content-encoding");
	responseHeaders.delete("transfer-encoding");
	responseHeaders.delete("content-security-policy");

	const contentType = responseHeaders.get("content-type") ?? "";
	if (contentType.includes("text/html")) {
		return new Response(injectTranslation(await upstreamResponse.text()), {
			status: upstreamResponse.status,
			headers: responseHeaders,
		});
	}
	if (incomingUrl.pathname === "/index.js" && contentType.includes("javascript")) {
		return new Response(patchBundle(await upstreamResponse.text()), {
			status: upstreamResponse.status,
			headers: responseHeaders,
		});
	}
	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		headers: responseHeaders,
	});
}

async function ensureServer(): Promise<void> {
	if (proxyServer) return;
	if (startPromise) return startPromise;
	startPromise = (async () => {
		upstreamUrl = await resolveUpstream();
		proxyServer = Bun.serve({
			hostname: LOCAL_HOST,
			port: LOCAL_PORT,
			fetch: proxyRequest,
			error(error) {
				return new Response(`Stats 中文代理错误：${error.message}`, { status: 502 });
			},
		});
	})().finally(() => {
		startPromise = undefined;
	});
	return startPromise;
}

function openDashboard(): void {
	let command: string[];
	switch (process.platform) {
		case "darwin":
			command = ["open", PUBLIC_URL];
			break;
		case "win32":
			command = ["cmd.exe", "/d", "/s", "/c", "start", "", PUBLIC_URL];
			break;
		default:
			command = ["xdg-open", PUBLIC_URL];
	}
	try {
		Bun.spawn(command, { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
	} catch {
		// 面板仍可通过通知中的 URL 手动打开。
	}
}

function stopServers(): void {
	proxyServer?.stop(true);
	proxyServer = undefined;
	upstreamUrl = undefined;
	ownedUpstreamProcess?.kill();
	ownedUpstreamProcess = undefined;
}

export default function statsZhExtension(pi: ExtensionAPI) {
	pi.registerCommand("stats-zh", {
		description: "打开中文 AI 使用统计面板（localhost:3947）",
		handler: async (_args, ctx) => {
			try {
				await ensureServer();
				openDashboard();
				ctx.ui.notify(`中文统计面板已打开：${PUBLIC_URL}`, "info");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`无法启动中文统计面板：${message}`, "error");
			}
		},
	});

	pi.on("session_shutdown", () => {
		stopServers();
	});
}
