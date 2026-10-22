<?php

/*
 * O autoloader do projeto, tanto num checkout do tema (com o próprio
 * `vendor/`) quanto instalado como pacote dentro de um fórum
 * (`vendor/lcoy/roselle` → `vendor/autoload.php`).
 */
$candidates = [
    dirname(__DIR__).'/vendor/autoload.php',
    dirname(__DIR__).'/../../autoload.php',
];

foreach ($candidates as $autoload) {
    if (is_file($autoload)) {
        require $autoload;

        // O fórum roda em UTC (o Laravel ajusta o fuso no boot); sem isso, os
        // testes de data herdariam o fuso do php.ini da máquina.
        date_default_timezone_set('UTC');

        // Instalado como pacote, o `autoload-dev` do tema não entra no
        // autoloader do fórum: as classes de apoio dos testes carregam aqui.
        spl_autoload_register(static function (string $class): void {
            $prefix = 'Lcoy\\Roselle\\Tests\\';

            if (! str_starts_with($class, $prefix)) {
                return;
            }

            $file = __DIR__.'/'.str_replace('\\', '/', substr($class, strlen($prefix))).'.php';

            if (is_file($file)) {
                require $file;
            }
        });

        return;
    }
}

throw new RuntimeException('Composer autoloader not found. Run `composer install` first.');
