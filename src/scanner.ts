import * as fs from "fs";
import * as lighthouse from "lighthouse";
import { launch } from "chrome-launcher"
import Sitemapper from "sitemapper";
import { args } from "./arguments";
import { path } from "chromium";
import { exit } from "process";

const reportFolder: string = new Date().toISOString().replace(/\//g, '-').replace(/:/g, '-');

const chromeOptions = {
    chromeFlags: ['--headless', '--disable-dev-shm-usage'],
    chromePath: path
}
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
}

function logResultsToScreen(url: string, fcp: number, lcp: number, tbt: number, cls: number, speed: number, finalScore: number): void {
    console.log(`\n\tLighthouse Results For: ${url}`);
    console.log(`\t🎨 FCP: ${fcp}`);
    console.log(`\t🖼️ LCP: ${lcp}`);
    console.log(`\t⌛️ TBT: ${tbt}`);
    console.log(`\t☁️ CLS:  ${cls}`);
    console.log(`\t🚀 Speed Index: ${speed}`);
    console.log(`\t🔥 Performance Score: ${finalScore * 100}`);
}

function writeResultsToFile(page: string, report: string, alerts: boolean): void {
    if (!fs.existsSync('reports')) {
        fs.mkdirSync('reports');
    }
    if (!fs.existsSync(`reports/${reportFolder}`)) {
        fs.mkdirSync(`reports/${reportFolder}`);
        fs.mkdirSync(`reports/${reportFolder}/pass`);
        fs.mkdirSync(`reports/${reportFolder}/fail`);
    }
    // clean up the URL and sort it into the proper folder
    // eslint-disable-next-line
    let pageSlug = page.replace(/^.*\/\/[^\/]+/, '').replace(/\//g, '-').slice(1);
    if (pageSlug[pageSlug.length - 1] === '-') {
        pageSlug = pageSlug.slice(0, pageSlug.length - 1);
    }
    // If there is nothing, it must be the index
    if (pageSlug === '') {
        pageSlug = 'index';
    }
    const targetFile = `reports/${reportFolder}/${alerts ? 'fail' : 'pass'}/${pageSlug}.html`
    fs.writeFileSync(`${targetFile}`, report);
}

async function getPagesToScan(): Promise<string[]> {
    const mapper = new Sitemapper({ timeout: 5000 });
    const { sites } = await mapper.fetch(args.url);

    const pages = sites.filter(item => {
        for (const excludePattern in args.exclude) {
            if (item.includes(excludePattern)) {
                return false;
            }
        }
        return true;
    });

    return pages;
}

async function scan(): Promise<void> {
    const pages = await getPagesToScan();
    const chrome = await launch(chromeOptions);
    lighthouseOptions.port = chrome.port;

    for (const page of pages) {
        let hasAlerts = false;
        console.log(`testing: ${page}`);
        const runnerResult = await lighthouse(page, lighthouseOptions);
        const first_contentful_paint = runnerResult.lhr.audits['first-contentful-paint'].displayValue;
        // const first_meaningful_paint = runnerResult.lhr.audits['first-meaningful-paint'].displayValue;
        const largest_contentful_paint = runnerResult.lhr.audits['largest-contentful-paint'].displayValue;
        const total_blocking_time = runnerResult.lhr.audits['total-blocking-time'].displayValue;
        const speed_index = runnerResult.lhr.audits['speed-index'].displayValue;
        const cls = runnerResult.lhr.audits['cumulative-layout-shift'].displayValue;

        logResultsToScreen(page, first_contentful_paint, largest_contentful_paint, total_blocking_time, cls, speed_index, runnerResult.lhr.categories.performance.score);

        if (runnerResult.lhr.audits['largest-contentful-paint'].numericValue > 2500) {
            console.log(`\t❌ LCP Over Limit: ${runnerResult.lhr.audits['largest-contentful-paint'].numericValue - 2500}ms`)
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
    await chrome.kill();
}

scan();