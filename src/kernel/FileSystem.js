class FileSystem {
    /**
     * @param {import('./StorageSystem.js').default} storageSystem 
     */

    constructor(storageSystem) {
        this.ss = storageSystem;
        this.rootDirectory = {
            apps: {
                type: "Folder",
                children: {}
            },
            files: {
                type: "Folder",
                children: {}
            }
        };
    }

    getItemCaseInsensitive(directory, itemName) {
        const lowerName = itemName.toLowerCase();
        for (const key in directory) {
            if (key.toLowerCase() === lowerName) {
                return [key, directory[key]];
            }
        }
        return null;
    }

    uniqueName(directory, baseName, extension = "") {
        let counter = 1;
        let newName = `${baseName}[${counter}]${extension}`;
        while (this.getItemCaseInsensitive(directory, newName)) {
            counter++;
            newName = `${baseName}[${counter}]${extension}`;
        }
        return newName;
    }

    createFile(filePath, content = "") {
        const pathArray = filePath.split("/").filter(str => str !== "");
        const fileName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const existing = this.getItemCaseInsensitive(directory, fileName);
        if (directory && !existing) {
            const { success, error } = this.ss.allocateStorage(filePath, 1);
            if (!success) {
                return { success: false, error };
            }
            directory[fileName] = { type: "File", content };
            return { success: true };
        }
        return { success: false, error: "ALREADY_EXIST" };
    }

    createFolder(filePath) {
        const pathArray = filePath.split("/").filter(str => str !== "");
        const folderName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const existing = this.getItemCaseInsensitive(directory, folderName);
        if (directory && !existing) {
            directory[folderName] = { type: "Folder", children: {} };
            return { success: true };
        }

        return { success: false, error: "ALREADY_EXIST" };
    }

    deleteFolder(filePath) {
        const pathArray = filePath.split("/").filter(str => str !== "");
        const folderName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const entry = this.getItemCaseInsensitive(directory, folderName);
        if (entry && entry[1].type === "Folder") {
            const children = entry[1].children;
            const fileNames = Object.keys(children);

            fileNames.forEach(child => {
                const item = children[child];
                const fullPath = `${filePath}/${child}`;
                if (item.type === "File") {
                    this.ss.deAllocateStorage(fullPath);
                } else if (item.type === "Folder") {
                    this.deleteFolder(fullPath);
                }
            });

            const [actualFolderName] = entry;
            delete directory[actualFolderName];
            return { success: true };
        }
        return { success: false, error: "FILE_DONT_EXIST" };
    }

    readFile(filePath) {
        const pathArray = filePath.split("/").filter(str => str !== "");
        const fileName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const entry = this.getItemCaseInsensitive(directory, fileName);
        return entry?.[1]?.type === "File" ? entry[1].content : null;
    }

    deleteFile(filePath) {
        const pathArray = filePath.split("/").filter(str => str !== "");
        const fileName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const entry = this.getItemCaseInsensitive(directory, fileName);
        if (entry && entry[1].type === "File") {
            this.ss.deAllocateStorage(filePath);
            const [actualFileName] = entry;
            delete directory[actualFileName];
            return { success: true };
        }
        return { success: false, error: "FILE_DONT_EXIST" };
    }

    writeFile(filePath, content) {
        const pathArray = filePath.split("/").filter(str => str !== "");
        const fileName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const entry = this.getItemCaseInsensitive(directory, fileName);

        if (entry && entry[1].type === "File") {
            const sizeKB = Math.ceil(content.length / 1024);
            this.ss.deAllocateStorage(filePath);
            const { success, error } = this.ss.allocateStorage(filePath, sizeKB);
            if (!success) {
                return { success: false, error };
            }
            entry[1].content = content;
            return { success: true };
        }
        return { success: false, error: "FILE_DONT_EXIST" };
    }

    renameFile(oldPath, newName) {
        const pathArray = oldPath.split("/").filter(str => str !== "");
        const oldName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const oldEntry = this.getItemCaseInsensitive(directory, oldName);
        const newEntry = this.getItemCaseInsensitive(directory, newName);
        if (!oldEntry) return { success: false, error: "FILE_NOT_FOUND" };
        if (newEntry) return { success: false, error: "NEW_NAME_EXISTS" };

        const [actualOldName, value] = oldEntry;

        const oldFullPath = [...pathArray, actualOldName].join("/");
        const newFullPath = [...pathArray, newName].join("/");
        this.ss.deAllocateStorage(oldFullPath);
        const { success, error } = this.ss.allocateStorage(newFullPath, 1);
        if (!success) return { success: false, error };

        directory[newName] = value;
        delete directory[actualOldName];
        return { success: true };
    }
    renameFolder(oldPath, newName) {
        const pathArray = oldPath.split("/").filter(str => str !== "");
        const oldName = pathArray.pop();
        const directory = this.traversePathCaseInsensitive(pathArray);
        const oldEntry = this.getItemCaseInsensitive(directory, oldName);
        const newEntry = this.getItemCaseInsensitive(directory, newName);
        if (!oldEntry || oldEntry[1].type !== "Folder") return { success: false, error: "FOLDER_NOT_FOUND" };
        if (newEntry) return { success: false, error: "NEW_NAME_EXISTS" };

        const [actualOldName, value] = oldEntry;
        directory[newName] = value;
        delete directory[actualOldName];
        return { success: true };
    }


    traversePathCaseInsensitive(pathArray) {
        let current = this.rootDirectory;
        for (const segment of pathArray) {
            const entry = this.getItemCaseInsensitive(current, segment);
            if (!entry || entry[1].type !== "Folder") return null;
            current = entry[1].children;
        }
        return current;
    }

    listDirectory(path = "/") {
        const pathArray = path.split("/").filter(str => str !== "");
        const directory = this.traversePathCaseInsensitive(pathArray) || this.rootDirectory;

        return Object.entries(directory).map(([name, item]) => ({
            name,
            type: item.type
        }));
    }
}

export default FileSystem;
