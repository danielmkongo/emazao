import { customAlphabet } from 'nanoid'

// Uppercase letters and digits only, without the characters people misread or
// mistype: no O/0, I/1. The default nanoid alphabet includes '_' and '-', which
// produced references like EM-4_1O6GLD — awkward to read out over the phone, to
// write on a delivery note, or to type into "Track my product".
const next = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8)

export const newOrderNumber = () => `EM-${next()}`
