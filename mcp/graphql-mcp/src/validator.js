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

        throw new Error(enhancedMessage, { cause: error });
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

    // Depth Limit Check (configurable; default 15 preserves the previous hardcoded limit)
    const maxDepth = config.GRAPHQL_MAX_DEPTH;
    const depth = calculateDepth(ast);
    if (depth > maxDepth) {
        throw new Error(`Validation Error: Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}.`);
    }

    // Complexity Limit Check (opt-in: only enforced when GRAPHQL_COMPLEXITY_LIMIT > 0)
    const complexityLimit = config.GRAPHQL_COMPLEXITY_LIMIT;
    if (complexityLimit > 0) {
        const complexity = calculateComplexity(ast);
        if (complexity > complexityLimit) {
            throw new Error(`Validation Error: Query complexity ${complexity} exceeds maximum allowed complexity of ${complexityLimit}.`);
        }
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
    const fragments = new Map(
        ast.definitions
            .filter(def => def.kind === Kind.FRAGMENT_DEFINITION)
            .map(def => [def.name.value, def])
    );

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
            maxDepth = Math.max(maxDepth, getDepth(def.selectionSet, fragments));
        }
    }

    return maxDepth;
}

function getDepth(selectionSet, fragments, currentDepth = 0, activeFragments = new Set()) {
    if (!selectionSet || !selectionSet.selections) return currentDepth;

    let maxChildDepth = currentDepth;

    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            if (selection.selectionSet) {
                const depth = getDepth(selection.selectionSet, fragments, currentDepth + 1, activeFragments);
                maxChildDepth = Math.max(maxChildDepth, depth);
            } else {
                // A leaf field acts as depth + 1
                maxChildDepth = Math.max(maxChildDepth, currentDepth + 1);
            }
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
            // For simplicity, treat fragments as passthrough or +0, but standard depth usually counts nested fields.
            // Inline fragments have a selectionSet.
            if (selection.selectionSet) {
                const depth = getDepth(selection.selectionSet, fragments, currentDepth, activeFragments); // Don't increment for fragment wrapper itself
                maxChildDepth = Math.max(maxChildDepth, depth);
            }
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
            const fragmentName = selection.name.value;
            if (activeFragments.has(fragmentName)) {
                continue;
            }

            const fragmentDefinition = fragments.get(fragmentName);
            if (fragmentDefinition?.selectionSet) {
                const nextActiveFragments = new Set(activeFragments);
                nextActiveFragments.add(fragmentName);
                const depth = getDepth(fragmentDefinition.selectionSet, fragments, currentDepth, nextActiveFragments);
                maxChildDepth = Math.max(maxChildDepth, depth);
            }
        }
    }
    return maxChildDepth;
}

/**
 * Calculates a rough complexity score for a GraphQL AST.
 * The score is the total number of selected fields across all operations and fragments,
 * which is a cheap, deterministic proxy for query cost.
 *
 * @param {object} ast - The parsed GraphQL document AST.
 * @returns {number} The complexity score.
 */
function calculateComplexity(ast) {
    let count = 0;
    visit(ast, {
        Field() {
            count += 1;
        }
    });
    return count;
}

/**
 * Enforces the introspection allowlist. When `config.INTROSPECTION_ALLOWLIST` is non-empty,
 * schema introspection is only permitted for endpoints present in the list. An empty
 * allowlist (the default) permits introspection of any configured endpoint — preserving
 * the previous behavior.
 *
 * @param {string} [endpoint=config.GRAPHQL_MCP_ENDPOINT] - The endpoint being introspected.
 * @throws {Error} If the endpoint is not allowlisted.
 */
export function assertIntrospectionAllowed(endpoint = config.GRAPHQL_MCP_ENDPOINT) {
    const allowlist = config.INTROSPECTION_ALLOWLIST || [];
    if (allowlist.length === 0) {
        return; // No allowlist configured: introspection is open (previous behavior).
    }
    if (!allowlist.includes(endpoint)) {
        throw new Error(
            `Introspection Error: Endpoint is not in the introspection allowlist.\n\n` +
            `How to fix:\n` +
            `1. Add the endpoint to the INTROSPECTION_ALLOWLIST environment variable (comma-separated).\n` +
            `2. Or leave INTROSPECTION_ALLOWLIST unset to permit introspection of the configured endpoint.`
        );
    }
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
        sanitized.errors = sanitized.errors
            // Drop null / non-object error items defensively so a malformed upstream
            // payload can never crash the sanitizer.
            .filter(err => err && typeof err === 'object')
            .map(err => {
                const cleanError = {
                    message: err.message || "Unknown Error",
                    locations: err.locations,
                    path: err.path,
                    extensions: err.extensions
                };

                // Sanitize extensions
                if (cleanError.extensions && typeof cleanError.extensions === 'object') {
                    // Remove stacktrace and internal exception details commonly added by some servers
                    delete cleanError.extensions.exception;
                    delete cleanError.extensions.stacktrace;
                }

                return cleanError;
            });
    }

    return sanitized;
}
