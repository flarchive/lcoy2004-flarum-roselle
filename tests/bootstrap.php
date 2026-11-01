<?php

/*
 * 项目的 autoloader，无论主题是在自己的检出目录中（带有自己的
 * `vendor/`），还是作为包安装在论坛内部
 * （`vendor/lcoy/roselle` → `vendor/autoload.php`）。
 */
$candidates = [
    dirname(__DIR__).'/vendor/autoload.php',
    dirname(__DIR__).'/../../autoload.php',
];

foreach ($candidates as $autoload) {
    if (is_file($autoload)) {
        require $autoload;

        // 论坛运行在 UTC（Laravel 在启动时调整时区）；否则日期测试
        // 会继承机器 php.ini 的时区。
        date_default_timezone_set('UTC');

        // 作为包安装时，主题的 `autoload-dev` 不会进入论坛的
        // autoloader：测试的辅助类在这里加载。
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
