"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.args = void 0;
const ts_command_line_args_1 = require("ts-command-line-args");
exports.args = (0, ts_command_line_args_1.parse)({
    url: { type: String },
    exclude: { type: String, multiple: true, optional: true }
});
//# sourceMappingURL=arguments.js.map