import util from "util";

// Monkey-patch console.log and console.error to prevent crashes from huge logs
const originalLog = console.log;
const originalError = console.error;

function safeLogArgs(args) {
    return args.map(arg => {
        if (typeof arg === 'string' && arg.length > 500) {
            return arg.substring(0, 500) + `... [TRUNCATED ${arg.length - 500} chars]`;
        }
        if (typeof arg === 'object' && arg !== null) {
            try {
                // Use util.inspect with strict limits to handle deep objects/arrays
                return util.inspect(arg, { depth: 2, maxStringLength: 500, colors: false, compact: true });
            } catch (e) {
                return '[Circular/Unsafe Object]';
            }
        }
        return arg;
    });
}

console.log = (...args) => originalLog.apply(console, safeLogArgs(args));
console.error = (...args) => originalError.apply(console, safeLogArgs(args));

console.log("Console logging patched for safety.");
