import { MOCK, api } from '../api/client.js'
import * as mock from '../mocks/operators.js'

export const { listOperators, createOperator, renameOperator, setOperatorActive } = MOCK ? mock : api
