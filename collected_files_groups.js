// Этот файл описывает группы для парсинга
// Допустимые статусы: full, signature, hide, ignore.
// Приоритет: Группы, описанные выше, имеют приоритет. Если один и тот же файл указан в разных группах, применится статус из первой встретившейся группы. Файлы, указанные в группах, будут обработаны, даже если они не лежат в TARGET_FOLDERS или имеют другое расширение.
module.exports = [     
    {
        "name": "Meta",
        "status": "full",
        "files": [
            "TechSteck.md",
            "MasterDocument.md",
            "archtecture_and_buisnes.md"
        ]
    },
    {
        "name": "Ignore",
        "status": "ignore",
        "files": [
            "stock-analyzer/node_modules/",
            "stock-analyzer/dist/"
        ]
    }
];