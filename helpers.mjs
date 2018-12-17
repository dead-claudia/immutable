/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                    I N T E R N A L   H E L P E R S                    *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function isIntegerIndex(value) {
    return value === Math.floor(value) &&
        value >= 0 && value <= 9007199254740991 /* 2^53 - 1 */
}

// eslint-disable-next-line no-self-compare
export const sameValueZero = (a, b) => a === b || a !== a && b !== b

export function updateKey(object, key, value) {
    if (!isIntegerIndex(key)) return {...object, [key]: value}
    object = object != null ? [...object] : []
    object[key] = value
    return object
}

export function cloneMapSet(object, init) {
    const clone = new object.constructor(object)

    init(clone)
    return clone
}

export const fromEntries = Object.fromEntries || (pairs => {
    const result = {}

    for (let i = 0; i < pairs.length; i++) {
        result[pairs[i][0]] = pairs[i][1]
    }

    return result
})
