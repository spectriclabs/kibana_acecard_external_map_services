import { KueryNode } from "@kbn/es-query";
import { KQL_WILDCARD_SYMBOL, KqlWildcardNode } from "@kbn/es-query/src/kuery/node_types/wildcard";


export type FunctionName = 'is' | 'and' | 'or' | 'not' | 'range' | 'exists' | 'nested';
const and = (node: KueryNode)=>{
    const children = node.arguments || [];
    return "(" + children.map((child: KueryNode) => {
        return toCql(child);
      }).join(" AND ") + ")"
}
const is = (node: KueryNode)=>{
    const {
        arguments: [fieldNameArg, valueArg],
      } = node;
    var operator = "=";
    if(valueArg.type === "wildcard"){
        operator = ""
    }
    let value = toCql(valueArg);
    if(valueArg.type === "literal"){
        value = `'${value}'`
    }
    return toCql(fieldNameArg) + operator + value
}

const or = (node: KueryNode)=>{
    const children = node.arguments || [];
    return "(" + children.map((child: KueryNode) => {
        return toCql(child);
      }).join(" OR ") + ")"
}
const not = (node: KueryNode)=>{
    const [argument] = node.arguments;
    return "NOT (" + toCql(argument) + ")"
}

const AST_TO_CQL ={
    "gt":">",
    "lt":"<",
    "gte": ">=",
    "lte":"<="
}
const range = (node: KueryNode)=>{
    const [fieldNameArg,operator, valueArg] = node.arguments;
    // @ts-ignore
    const opsign = AST_TO_CQL[operator];
    let value = toCql(valueArg);
    if(valueArg.type === "literal"){
        value = `'${value}'`
    }
    return `${fieldNameArg.value} ${opsign} ${value}`
}
export const functions = {
    is,
    and,
    or,
    not,
    range,
  };
const nodeTypes = {
    function:(node: KueryNode)=>{
        // @ts-ignore
        return functions[node.function as FunctionName](node);
    },
    literal:(node: KueryNode)=> {
        return node.value;
    },
    wildcard: (node: KqlWildcardNode) =>{
        const { value } = node;
        return ` LIKE '${value.split(KQL_WILDCARD_SYMBOL).join('%')}'`;
      }
}

export const toCql = (
    node: KueryNode,
  ): string => {
    const nodeType = nodeTypes[node.type] as unknown as any;
    return nodeType(node);
  };



/*
FIXME ADD TESTS


*/