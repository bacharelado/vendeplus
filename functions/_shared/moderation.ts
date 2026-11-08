export function moderateOffer(title:string,description:string):'review'|'allow'{
 const normalized=(title+' '+description).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const restricted=/(?:arma de fogo|munic(?:ao|oes)|documentos? falsos?|contas? bancarias? para venda|cigarros? eletronicos?|drogas? ilicitas?)/;
 return restricted.test(normalized)?'review':'allow';
}
