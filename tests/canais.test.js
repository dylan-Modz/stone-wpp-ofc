import test from 'node:test';
import assert from 'node:assert/strict';
import { pesquisarCanais, calcularEstatisticas, resumirReacoes, resumirEnquete } from '../lib/Recursos/Canais/index.js';

test('Stone busca local ignora maiúsculas e acentos', () => {
    assert.equal(pesquisarCanais([{name:'Canal Café'},{name:'Outros'}], 'CAFE').length, 1);
    assert.equal(pesquisarCanais([{name:'A'},{name:'B'}], '', {limite: 1}).length, 1);
});
test('Stone conta métricas fornecidas', () => {
    assert.deepEqual(calcularEstatisticas([{views:100,reactions:['❤️','👍'],poll:true}]), {
        mensagens:1, visualizacoes:100, reacoes:2, enquetes:1, taxaDeReacao:0.02
    });
    assert.deepEqual(resumirReacoes(['❤️','❤️',{emoji:'👍',count:3}]), {'❤️':2,'👍':3});
    assert.equal(resumirEnquete({name:'Teste',options:[{optionName:'A',votes:2}]}).totalVotos,2);
});
