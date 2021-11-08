# Lighthouse Site Scanner
A simple tool to read a sites `sitemap.xml`, parse it, and then run each page through a local chromium instance and measure it's lighthouse performance. The performance is also output to the console to show which metrics are failing according to the threshold for 90+ mobile performance.

## Reason
This was a replacement for running page speed insights via google when doing testing of site-wide performance. It also was meant to replace functions of certain products such as sitebulb which were simply way too slow.

## Running The Tool
After running npm install, simply call the tool with -u and feed it the main sitemap url. It will use this to parse all URL's and begin running lighthouse.
```
npm install
node lighthouse.js -u [sitemap_url_here]
// with exclusions of pages under /blog/ and /author/
node lighthouse.js -u [sitemap_url_here] -x /blog/ /author/
```

## Output
A reports folder will be generated with timestamp containing the saved lighthouse results separated into 2 folders: pass and fail. The URL's will be the slugged final URL of the page that was scanned. The contents are the same results you would see on page speed insights.
