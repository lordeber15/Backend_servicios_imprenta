import os
import re

def fix_paths(directory, replacements):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".js"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                original_content = content
                for pattern, replacement in replacements:
                    content = re.sub(pattern, replacement, content)
                
                if content != original_content:
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"Fixed: {path}")

base_path = "/Users/ebersonpalomino/Desktop/imprenta/Desarrollo/Backend_servicios_imprenta"

# Subfolder corrections (controllers and routes)
web_subfolders = [
    "src/infrastructure/web/controllers/facturacion",
    "src/infrastructure/web/routes/facturacion",
    "src/infrastructure/web/controllers/Tickets",
    "src/infrastructure/web/routes/Tickets",
    "src/infrastructure/web/controllers/almanaque",
    "src/infrastructure/web/routes/almanaque",
    "src/infrastructure/web/controllers/caja",
    "src/infrastructure/web/routes/caja",
    "src/infrastructure/web/controllers/ingresosyegresos",
    "src/infrastructure/web/routes/ingresosyegresos"
]

web_replacements = [
    (r'require\("../../database/models/', r'require("../../../database/models/'),
    (r'require\("../controllers/', r'require("../../controllers/'),
    (r'require\("../../models/facturacion/', r'require("../../../database/models/facturacion/'),
    (r'require\("../../database/database"', r'require("../../../database/database"'), # This might be the source of some issues
    (r'require\("../../services/sunat/', r'require("../../../external_services/sunat/'),
]

# Model corrections
model_subfolders = [
    "src/infrastructure/database/models/Ingresosyegresos",
    "src/infrastructure/database/models/Tickets",
    "src/infrastructure/database/models/almanaque",
    "src/infrastructure/database/models/caja",
    "src/infrastructure/database/models/facturacion"
]

model_replacements = [
    (r'require\("../../database/database"\)', r'require("../../database")'),
]

for sub in web_subfolders:
    fix_paths(os.path.join(base_path, sub), web_replacements)

for sub in model_subfolders:
    fix_paths(os.path.join(base_path, sub), model_replacements)

# Root level corrections
root_controllers = os.path.join(base_path, "src/infrastructure/web/controllers")
root_replacements = [
    (r'require\("../models/', r'require("../../database/models/'),
]
fix_paths(root_controllers, root_replacements)
