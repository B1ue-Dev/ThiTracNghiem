/**
 * jsreport Service — Khởi tạo jsreport-core để render báo cáo
 */
const jsreport = require('@jsreport/jsreport-core');

let reporter = null;

async function initJsReport() {
    if (reporter) return reporter;

    reporter = jsreport({
        store: { provider: 'memory' }, // template được tạo inline nên ko cần store file
        logger: { silent: true },
        allowLocalFilesAccess: true
    });

    reporter.use(require('@jsreport/jsreport-handlebars')());
    reporter.use(require('@jsreport/jsreport-chrome-pdf')());
    reporter.use(require('@jsreport/jsreport-html-to-xlsx')());
    reporter.use(require('@jsreport/jsreport-text')());

    await reporter.init();
    console.log('✅ jsreport engine initialized successfully!');
    return reporter;
}

function getReporter() {
    if (!reporter) throw new Error("jsreport isn't initialized!");
    return reporter;
}

module.exports = { initJsReport, getReporter };
