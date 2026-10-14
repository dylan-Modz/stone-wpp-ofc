import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../lib/Store/index.js';
import { criarHistoricoGrupos, criarPermissoesGrupos } from '../lib/Recursos/Grupos/index.js';

test('Stone controla permissões usando as operações reais do socket', async () => {
    const chamadas=[];
    const socket={
        groupSettingUpdate:async(...a)=>chamadas.push(a),
        groupJoinApprovalMode:async(...a)=>chamadas.push(a),
        groupMemberAddMode:async(...a)=>chamadas.push(a),
        groupRequestParticipantsList:async()=>['1'],
        groupRequestParticipantsUpdate:async(...a)=>chamadas.push(a)
    };
    const p=criarPermissoesGrupos(socket);
    await p.somenteAdminsEnviam('g@g.us');
    await p.aprovarEntrada('g@g.us',false);
    await p.permitirAdicaoPorMembros('g@g.us');
    assert.deepEqual(chamadas,[['g@g.us','announcement'],['g@g.us','off'],['g@g.us','all_member_add']]);
    assert.deepEqual(await p.solicitacoes('g@g.us'),['1']);
});
test('Stone armazena histórico local voluntário de grupos', async () => {
    const h=criarHistoricoGrupos(createMemoryStore());
    await h.salvar('123@g.us',{text:'primeira'});
    await h.salvar('123@g.us',{text:'segunda'},1);
    assert.deepEqual(await h.listar('123@g.us'),[{text:'segunda'}]);
    assert.equal(await h.apagar('123@g.us'),true);
});
