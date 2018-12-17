/* global Map, Set */
import {
    isIntegerIndex, sameValueZero, updateKey, cloneMapSet, fromEntries,
} from "./helpers.mjs"

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                        C O R E   M E T H O D S                        *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                      ` c r e a t e ( v i e w ) `                      *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function create(view) {
    if (view == null) return undefined
    if (typeof view === "object") return view.create()
    if (isIntegerIndex(view)) return []
    return {}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                 ` g e t ( o b j e c t ,   v i e w ) `                 *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function get(object, view) {
    if (object == null) return undefined
    if (view == null) return object
    if (typeof view !== "object") return object[view]
    return view.get(object)
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *          ` s e t ( o b j e c t ,   v i e w ,   v a l u e ) `          *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function set(object, view, value) {
    if (view == null) return value
    if (typeof view !== "object") return updateKey(object, view, value)
    if (object == null) object = view.create()
    if ("set" in view) return view.set(object, value)
    return view.update(object, () => value)
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *        ` u p d a t e ( o b j e c t ,   v i e w ,   f u n c ) `        *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function update(object, view, func) {
    if (view == null) return object
    if (typeof view !== "object") {
        return updateKey(object, view, func(object[view]))
    }
    if ("update" in view) return view.update(object, func)
    return view.set(object, func(
        object == null ? undefined : view.get(object))
    )
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                 ` h a s ( o b j e c t ,   v i e w ) `                 *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function has(object, view) {
    if (object == null) return false
    if (view == null) return true
    if (typeof view !== "object") return view in object
    return !!view.has(object)
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *              ` r e m o v e ( o b j e c t ,   v i e w ) `              *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function remove(object, view) {
    if (object == null) return undefined
    if (view == null) return object
    if (typeof view === "object") return view.remove(object)
    const result = isIntegerIndex(view) ? [] : {}

    for (const key of Object.keys(view)) {
        if (key !== view) result[key] = object[key]
    }

    return result
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *             W R A P P E R   A P I :   ` i ( v a l u e ) `             *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function wrap(wrapped) {
    return {
        value: wrapped,
        valueOf: () => wrapped,
        get: view => wrap(get(wrapped, view)),
        set: (view, value) => wrap(set(wrapped, view, value)),
        update: (view, func) => wrap(update(wrapped, view, func)),
        has: view => wrap(has(wrapped, view)),
        remove: view => wrap(remove(wrapped, view)),
    }
}
export {wrap as i}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                 C O R E   V I E W   F A C T O R I E S                 *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *              C O M P O S E :   ` c ( . . . v i e w s ) `              *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function compose(...views) {
    if (views.length === 0) return undefined
    if (views.length === 1) return views[0]

    const nest = (object, i, onEnd, arg) => i + 1 === views.length
        ? onEnd(object, views[i], arg)
        : update(object, views[i], object => nest(object, i + 1, onEnd, arg))

    function loop(object, ifNull, ifMatched) {
        for (const view of views.slice(0, -1)) {
            object = get(object, view)
            if (object == null) return ifNull
        }

        return ifMatched(object, views[views.length - 1])
    }

    const createLoop = (i, value) => i === views.length ? value : update(
        create(views[i]), views[i],
        object => createLoop(i + 1, object)
    )

    return {
        create: () => createLoop(0),
        get: object => loop(object, undefined, get),
        set: (object, value) => nest(object, 0, set, value),
        update: (object, func) => nest(object, 0, update, func),
        has: object => loop(object, undefined, has),
        remove: object => nest(object, 0, remove),
    }
}
export {compose as c}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *            P R O P E R T Y :   ` p ( { . . . k e y s } ) `            *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function splitProperty(props) {
    const pairs = Object.entries(props)
    const mapProps = func => fromEntries(pairs.map(func))

    return {
        create: () => mapProps(pair => create(pair[1])),
        get: object => mapProps(([key, path]) => get(object[key], path)),
        set: (object, value) => ({...object, ...mapProps(
            ([key, path]) => set(object[key], path, value[key])
        )}),
        has: object => pairs.some(([key, path]) => has(object[key], path)),
        remove: object => mapProps(([key, path]) => remove(object[key], path)),
    }
}
export {splitProperty as p}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                   C O R E   V I E W   H E L P E R S                   *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                              ` h e a d `                              *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export const head = {
    create: () => [],
    get: ([value]) => value,
    set: (object, value) => [value, ...object],
    has: object => object.length !== 0,
    remove: ([, ...result]) => result,
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                              ` t a i l `                              *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export const tail = {
    create: () => [],
    get: object => object.length !== 0 ? object[object.length - 1] : undefined,
    set: (object, value) => [...object, value],
    has: object => object.length !== 0,
    remove: object => object.slice(0, -1),
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                    ` f i r s t I t e m ( k e y ) `                    *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function firstItem(key) {
    return {
        has: object => object.includes(key),
        remove(object) {
            const index = object.findIndex(v => v === key)
            const clone = [...object]

            if (index >= 0) clone.splice(index, 1)
            return clone
        },
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                         ` i t e m ( k e y ) `                         *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function item(key) {
    return {
        get: object => object.reduce(
            (sum, current) => sum + sameValueZero(current, key),
            0
        ),
        has: object => object.some(current => sameValueZero(current, key)),
        remove: object => object.filter(current =>
            !sameValueZero(current, key)
        ),
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                  ` f i l t e r ( s e l e c t o r ) `                  *
 *                                                                       *
 *                  ` r e j e c t ( s e l e c t o r ) `                  *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function filter(selector) {
    return makeFilter(selector, true)
}

export function reject(selector) {
    return makeFilter(selector, false)
}

function makeFilter(selector, expect) {
    const matches = (current, i) => expect === !!selector(current, i)

    return {
        create: () => [],
        get: object => object.reduce(
            (sum, current, i) => sum + matches(current, i),
            0
        ),

        update: (object, func) => object.map((current, i) =>
            matches(current, i) ? func(current) : current
        ),

        has: object => object.some(matches),
        remove: object => object.filter((current, i) => !matches(current, i)),
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                              ` e a c h `                              *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export const each = {
    create: () => [],
    get: object => object,
    update: (object, func) => object.map(current => func(current)),
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                 ` s l i c e ( s t a r t ,   e n d ) `                 *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function slice(start, end) {
    return {
        get: object => object.slice(start, end),
        set: (object, value) => {
            const length = end - start
            const clone = [...object, ...value]

            for (let i = value.length; i < length; i++) {
                clone[start + i] = undefined
            }

            return clone
        },
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                            ` c o n c a t `                            *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export const concat = {
    create: () => [],
    set: (object, value) => object.concat(value),
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                           ` r e v e r s e `                           *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export const reverse = {
    create: () => [],
    get: object => [...object].reverse(),
    set: (object, value) => [...value].reverse(),
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                            ` s e t A d d `                            *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export const setAdd = {
    create: () => new Set(),
    set: (object, value) => cloneMapSet(object, c => c.add(value)),
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                       ` s e t K e y ( k e y ) `                       *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function setKey(key) {
    return {
        has: object => object.has(key),
        remove: object => cloneMapSet(object, c => c.delete(key)),
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                       ` m a p K e y ( k e y ) `                       *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function mapKey(key) {
    return {
        create: () => new Map(),
        get: object => object.get(key),
        set: (object, value) => cloneMapSet(object, c => c.set(key, value)),
        has: object => object.has(key),
        remove: object => cloneMapSet(object, c => c.delete(key)),
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *           ` i n v o k e ( m e t h o d ,   . . . a r g s ) `           *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export function invoke(method, ...args) {
    return {get: object => object[method](...args)}
}
