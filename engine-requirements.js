const major = Number.parseInt(process.versions.node.split('.')[0], 10);

if (!Number.isFinite(major) || major < 24) {
  console.error(
    `\n[ STONE ] Node.js 24 ou superior é necessário.\n` +
    `[ STONE ] Versão atual: ${process.versions.node}\n` +
    `[ STONE ] Atualize o Node.js antes de instalar a biblioteca.\n`
  );
  process.exit(1);
}
