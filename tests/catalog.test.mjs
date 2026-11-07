import test from 'node:test';
import assert from 'node:assert/strict';
import {filterListings} from '../src/lib/catalog.mjs';

const samples = [
  {id: 1, title: 'Bolo de pote', description: 'Chocolate', seller: 'Maria', status: 'PUBLICADO', category: 'Alimentação', condition: 'Novo', priceCents: 1200},
  {id: 2, title: 'Corte de cabelo', description: 'Barbearia', seller: 'Beto', status: 'PUBLICADO', category: 'Serviços', condition: 'Não aplicável', priceCents: 3000},
  {id: 3, title: 'Celular usado', description: 'Galaxy', seller: 'João', status: 'EM_ANALISE', category: 'Eletrônicos', condition: 'Usado', priceCents: 35000},
  {id: 4, title: 'Pintura residencial', description: 'Sob orçamento', seller: 'Pedro', status: 'PUBLICADO', category: 'Serviços', condition: 'Não aplicável', priceCents: null},
];

test('não exibir anúncios em análise', () => {
  assert.deepEqual(filterListings(samples).map(x => x.id), [4,2,1]);
});

test('filtrar por categoria e condição', () => {
  assert.deepEqual(filterListings(samples, {category:'Serviços',condition:'Não aplicável'}).map(x=>x.id), [4,2]);
});

test('pesquisa ignora caixa e espaços nas pontas', () => {
  assert.deepEqual(filterListings(samples, {query:'  bOlO  '}).map(x=>x.id), [1]);
});

test('ordenar por menor preço deixa orçamento por último', () => {
  assert.deepEqual(filterListings(samples, {sortOrder:'menor'}).map(x=>x.id), [1,2,4]);
});

test('ordenar por maior preço deixa orçamento por último', () => {
  assert.deepEqual(filterListings(samples, {sortOrder:'maior'}).map(x=>x.id), [2,1,4]);
});
