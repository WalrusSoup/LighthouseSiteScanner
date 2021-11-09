"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const lighthouse_1 = require("lighthouse");
const chrome_launcher_1 = require("chrome-launcher");
const sitemapper_1 = require("sitemapper");
const arguments_1 = require("./arguments");
const chromium_1 = require("chromium");
console.log(lighthouse_1.default);
const reportFolder = new Date().toISOString().replace(/\//g, '-').replace(/:/g, '-');
console.log(chromium_1.path);
const chromeOptions = {
    chromeFlags: ['--headless', '--disable-dev-shm-usage'],
    chromePath: chromium_1.path
};
const lighthouseOptions = {
    logLevel: 'error',
    output: 'html',
    onlyCategories: ['performance'],
    port: 0,
    throttle: {
        rttMs: 150,
        throughputKbps: 1.6 * 1024,
        cpuSlowdownMultiplier: 4
    }
};
function logResultsToScreen(url, fcp, lcp, tbt, cls, speed, finalScore) {
    console.log(`\n\tLighthouse Results For: ${url}`);
    console.log(`\t🎨 FCP: ${fcp}`);
    console.log(`\t🖼️ LCP: ${lcp}`);
    console.log(`\t⌛️ TBT: ${tbt}`);
    console.log(`\t☁️ CLS:  ${cls}`);
    console.log(`\t🚀 Speed Index: ${speed}`);
    console.log(`\t🔥 Performance Score: ${finalScore * 100}`);
}
function writeResultsToFile(page, report, alerts) {
    if (!fs_1.default.existsSync('reports')) {
        fs_1.default.mkdirSync('reports');
    }
    if (!fs_1.default.existsSync(`reports/${reportFolder}`)) {
        fs_1.default.mkdirSync(`reports/${reportFolder}`);
        fs_1.default.mkdirSync(`reports/${reportFolder}/pass`);
        fs_1.default.mkdirSync(`reports/${reportFolder}/fail`);
    }
    let pageSlug = page.replace(/^.*\/\/[^\/]+/, '').replace(/\//g, '-').slice(1);
    if (pageSlug[pageSlug.length - 1] === '-') {
        pageSlug = pageSlug.slice(0, pageSlug.length - 1);
    }
    if (pageSlug === '') {
        pageSlug = 'index';
    }
    const targetFile = `reports/${reportFolder}/${alerts ? 'fail' : 'pass'}/${pageSlug}.html`;
    fs_1.default.writeFileSync(`${targetFile}`, report);
}
function getPagesToScan() {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const mapper = new sitemapper_1.default({ timeout: 5000 });
        const { sites } = yield mapper.fetch(arguments_1.args.url);
        const pages = sites.filter(item => {
            for (const excludePattern in arguments_1.args.exclude) {
                if (item.includes(excludePattern)) {
                    return false;
                }
            }
            return true;
        });
        return pages;
    });
}
function scan() {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const pages = yield getPagesToScan();
        const chrome = yield (0, chrome_launcher_1.launch)(chromeOptions);
        lighthouseOptions.port = chrome.port;
        for (const page of pages) {
            let hasAlerts = false;
            console.log(`testing: ${page}`);
            const runnerResult = yield (0, lighthouse_1.default)(page, lighthouseOptions);
            const first_contentful_paint = runnerResult.lhr.audits['first-contentful-paint'].displayValue;
            const largest_contentful_paint = runnerResult.lhr.audits['largest-contentful-paint'].displayValue;
            const total_blocking_time = runnerResult.lhr.audits['total-blocking-time'].displayValue;
            const speed_index = runnerResult.lhr.audits['speed-index'].displayValue;
            const cls = runnerResult.lhr.audits['cumulative-layout-shift'].displayValue;
            logResultsToScreen(page, first_contentful_paint, largest_contentful_paint, total_blocking_time, cls, speed_index, runnerResult.lhr.categories.performance.score);
            if (runnerResult.lhr.audits['largest-contentful-paint'].numericValue > 2500) {
                console.log(`\t❌ LCP Over Limit: ${runnerResult.lhr.audits['largest-contentful-paint'].numericValue - 2500}ms`);
                hasAlerts = true;
            }
            if (runnerResult.lhr.audits['cumulative-layout-shift'].numericValue > .10) {
                console.log(`\t❌ CLS Too High: ${runnerResult.lhr.finalUrl}`);
                hasAlerts = true;
            }
            if (runnerResult.lhr.audits['first-meaningful-paint'].numericValue < 2500 && runnerResult.lhr.audits['cumulative-layout-shift'].numericValue < .10 && runnerResult.lhr.audits['largest-contentful-paint'].numericValue <= 2500) {
                console.log(`\t🍀 Results OK!`);
            }
            writeResultsToFile(page, runnerResult.report, hasAlerts);
        }
        yield chrome.kill();
    });
}
scan();
//# sourceMappingURL=scanner.js.map