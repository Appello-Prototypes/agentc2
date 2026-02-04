export type JsonPatchOperation = {
    op: "add" | "remove" | "replace";
    path: string;
    value?: unknown;
};

function decodePointer(segment: string) {
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function cloneValue<T>(value: T): T {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
}

function getContainer(target: unknown, segments: string[], createMissing: boolean) {
    let current = target as Record<string, unknown> | unknown[];
    for (let i = 0; i < segments.length - 1; i += 1) {
        const key = decodePointer(segments[i]);
        const next =
            Array.isArray(current) && Number.isInteger(Number(key))
                ? (current as unknown[])[Number(key)]
                : (current as Record<string, unknown>)[key];

        if (next === undefined) {
            if (!createMissing) {
                throw new Error(`Path does not exist: /${segments.slice(0, i + 1).join("/")}`);
            }
            const newContainer = {};
            if (Array.isArray(current) && Number.isInteger(Number(key))) {
                (current as unknown[])[Number(key)] = newContainer;
            } else {
                (current as Record<string, unknown>)[key] = newContainer;
            }
            current = newContainer as Record<string, unknown>;
        } else {
            current = next as Record<string, unknown> | unknown[];
        }
    }
    const lastKey = decodePointer(segments[segments.length - 1]);
    return { container: current, key: lastKey };
}

export function applyJsonPatch<T>(document: T, patch: JsonPatchOperation[]): T {
    let result = cloneValue(document);

    for (const operation of patch) {
        const { op, path, value } = operation;
        if (!path.startsWith("/")) {
            if (path === "" && (op === "add" || op === "replace")) {
                result = value as T;
                continue;
            }
            throw new Error(`Invalid JSON pointer: ${path}`);
        }
        const segments = path.split("/").slice(1);
        if (segments.length === 0) {
            if (op === "remove") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                result = undefined as any;
            } else {
                result = value as T;
            }
            continue;
        }

        const { container, key } = getContainer(result, segments, op === "add");

        if (Array.isArray(container)) {
            const index =
                key === "-" ? container.length : Number.isInteger(Number(key)) ? Number(key) : -1;
            if (index < 0 || Number.isNaN(index)) {
                throw new Error(`Invalid array index: ${key}`);
            }
            if (op === "add") {
                if (key === "-") {
                    container.push(value);
                } else {
                    container.splice(index, 0, value);
                }
            } else if (op === "remove") {
                container.splice(index, 1);
            } else if (op === "replace") {
                container[index] = value as unknown;
            }
        } else {
            if (op === "add" || op === "replace") {
                (container as Record<string, unknown>)[key] = value;
            } else if (op === "remove") {
                delete (container as Record<string, unknown>)[key];
            }
        }
    }

    return result;
}

export function patchTouchesProtectedPaths(
    patch: JsonPatchOperation[],
    protectedPrefixes: string[]
) {
    return patch.some((operation) =>
        protectedPrefixes.some((prefix) => operation.path.startsWith(prefix))
    );
}
