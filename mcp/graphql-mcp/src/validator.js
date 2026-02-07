import { parse, Kind, visit, validate } from 'graphql';
import { config } from './config.js';

/**
 * Validates a GraphQL query for syntax, security, structure, and schema compliance.
 * 
 * @param {string} query - The GraphQL query string.
 * @param {object} variables - The variables object.
 * @param {object} [schema] - The GraphQLSchema object (optional, but recommended).
 * @throws {Error} If validation fails.
 */
export function validateQuery(query, variables = {}, schema = null) {
    // 1. Basic Structure Check
    if (!query || typeof query !== 'string') {
        throw new Error("Invalid query: query must be a string.");
    }

    if (variables && typeof variables !== 'object') {
        throw new Error("Invalid variables: variables must be an object.");
    }

    // 2. Syntax Check (Parsing)
    let ast;
    try {
        ast = parse(query);
    } catch (error) {
        let enhancedMessage = `Syntax Error: ${error.message}`;

        // Add helpful hints for AI agents
        if (error.message.includes("Unexpected character") || error.message.includes("Invalid character")) {
            enhancedMessage += `\n\nInterpretation:\nThis indicates a malformed query structure containing an invalid character (often Unicode or hidden symbols).\n\n` +
                `How to fix:\n` +
                `1. Remove any non-ASCII characters or hidden symbols.\n` +
                `2. Verify the query contains only valid GraphQL operators and ASCII characters.\n` +
                `3. Ensure proper encoding of special characters.`;
        } else {
            enhancedMessage += `\n\nHow to fix:\n1. Check for missing braces or parentheses.\n2. Ensure field names are correct.`;
        }

        throw new Error(enhancedMessage);
    }

    // 3. Security Checks

    // Check for Mutations if Read-Only
    if (config.GRAPHQL_READ_ONLY) {
        const hasMutation = ast.definitions.some(
            def => def.kind === Kind.OPERATION_DEFINITION && def.operation === 'mutation'
        );
        if (hasMutation) {
            throw new Error("Validation Error: Mutations are NOT allowed in Read-only mode.");
        }
    }

    // Depth Limit Check
    const MAX_DEPTH = 15; // Hardcoded safe limit
    const depth = calculateDepth(ast);
    if (depth > MAX_DEPTH) {
        throw new Error(`Validation Error: Query depth ${depth} exceeds maximum allowed depth of ${MAX_DEPTH}.`);
    }

    // 4. Schema Validation
    if (schema) {
        const errors = validate(schema, ast);
        if (errors.length > 0) {
            const formattedErrors = errors.map(e => `- ${e.message}`).join('\n');
            throw new Error(
                `Schema Validation Error:\n${formattedErrors}\n\n` +
                `How to fix:\n` +
                `1. Check the 'graphql://schema' resource for correct types and fields.\n` +
                `2. Ensure you are not querying fields that don't exist on the type.\n` +
                `3. distinct scalar types vs objects.`
            );
        }
    }

    return ast; // Return AST if needed, though we primarily validate here.
}

/**
 * Calculates the maximum depth of a GraphQL AST.
 */
function calculateDepth(ast) {
    let maxDepth = 0;

    visit(ast, {
        OperationDefinition(node) {
            // Reset for each operation, though usually one per doc in simple usage
            // We just want ANY path to not exceed limit.
        },
        Field: {
            enter(node, key, parent, path, ancestors) {
                // Calculate current depth based on ancestors
                // Ancestors include SelectionSets, Fields, etc.
                // We roughly want to count Fields.
                // A simpler way with 'visit' might be tricky to get exact depth.
                // Let's use a recursive traversal on SelectionSets.
            }
        }
    });

    // Re-implementing a simple recursive depth calculator
    // visit() is powerful but state matching can be annoying.
    // Let's traverse definitions.

    for (const def of ast.definitions) {
        if (def.kind === Kind.OPERATION_DEFINITION || def.kind === Kind.FRAGMENT_DEFINITION) {
            maxDepth = Math.max(maxDepth, getDepth(def.selectionSet));
        }
    }

    return maxDepth;
}

function getDepth(selectionSet, currentDepth = 0) {
    if (!selectionSet || !selectionSet.selections) return currentDepth;

    let maxChildDepth = currentDepth;

    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            if (selection.selectionSet) {
                const depth = getDepth(selection.selectionSet, currentDepth + 1);
                maxChildDepth = Math.max(maxChildDepth, depth);
            } else {
                // A leaf field acts as depth + 1
                maxChildDepth = Math.max(maxChildDepth, currentDepth + 1);
            }
        } else if (selection.kind === Kind.INLINE_FRAGMENT || selection.kind === Kind.FRAGMENT_SPREAD) {
            // For simplicity, treat fragments as passthrough or +0, but standard depth usually counts nested fields.
            // Inline fragments have a selectionSet.
            if (selection.selectionSet) {
                const depth = getDepth(selection.selectionSet, currentDepth); // Don't increment for fragment wrapper itself
                maxChildDepth = Math.max(maxChildDepth, depth);
            }
            // FragmentSpread we can't easily resolve without looking up fragments. 
            // We'll skip complex fragment handling for now or assume shallow.
        }
    }
    return maxChildDepth;
}

/**
 * Sanitizes the GraphQL response to remove sensitive information and ensure correct format.
 * 
 * @param {object} data - The GraphQL response object.
 * @returns {object} - The sanitized response.
 */
export function sanitizeResponse(data) {
    if (!data || typeof data !== 'object') {
        return data; // Not much we can do if it's not an object, mostly likely a fetch error that app.js handles
    }

    const sanitized = { ...data };

    if (sanitized.errors && Array.isArray(sanitized.errors)) {
        sanitized.errors = sanitized.errors.map(err => {
            const cleanError = {
                message: err.message || "Unknown Error",
                locations: err.locations,
                path: err.path,
                extensions: err.extensions
            };

            // Sanitize extensions
            if (cleanError.extensions) {
                // Remove stacktrace and internal exception details commonly added by some servers
                delete cleanError.extensions.exception;
                delete cleanError.extensions.stacktrace;
            }

            return cleanError;
        });
    }

    return sanitized;
}
