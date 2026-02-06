/**
 * Summarizes data for logging purposes.
 * Truncates long strings, limits array lengths, and recursively summarizes objects.
 * 
 * @param {any} data - The data to summarize.
 * @param {number} maxLength - Maximum length for strings.
 * @param {number} maxArrayLength - Maximum number of items in an array.
 * @param {number} depth - Current recursion depth (internal usage).
 * @returns {any} - The summarized data.
 */
export function summarize(data, maxLength = 100, maxArrayLength = 10, depth = 0) {
    if (depth > 5) return "[Deep Object]";

    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'string') {
        if (data.length <= maxLength) return data;
        return data.substring(0, maxLength) + `... (${data.length} chars)`;
    }

    if (Array.isArray(data)) {
        const summary = data.slice(0, maxArrayLength).map(item => summarize(item, maxLength, maxArrayLength, depth + 1));
        if (data.length > maxArrayLength) {
            summary.push(`... ${data.length - maxArrayLength} more items`);
        }
        return summary;
    }

    if (typeof data === 'object') {
        const summary = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                summary[key] = summarize(data[key], maxLength, maxArrayLength, depth + 1);
            }
        }
        return summary;
    }

    return data;
}
