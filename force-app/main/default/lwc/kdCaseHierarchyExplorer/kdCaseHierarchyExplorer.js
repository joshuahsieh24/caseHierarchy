import { LightningElement, api, wire, track } from 'lwc';
import getHierarchy from '@salesforce/apex/KD_CaseHierarchyController.getHierarchy';

const BASE_COLUMNS = [
    { label: 'Case #', fieldName: 'caseUrl', type: 'url',
      typeAttributes: { label: { fieldName: 'caseNumber' }, target: '_blank' } },
    { label: 'Subject', fieldName: 'subject', wrapText: true },
    { label: 'Status', fieldName: 'status' },
    { label: 'Priority', fieldName: 'priority' },
    { label: 'Type', fieldName: 'caseType' },
    { label: 'Child Count', fieldName: 'childCount', type: 'number' }
];

export default class KdCaseHierarchyExplorer extends LightningElement {
    @api recordId;

    @track columns = [...BASE_COLUMNS];
    @track isConfigMode = false;
    @track draftColumns = [];
    @track draftValues = [];
    @track treeGridKey = 'tree-grid-1';

    treeData;
    originalData;
    expandedRows = [];
    isLoading = true;
    noCasesFound = false;
    hasError = false;
    errorMessage = '';

    @wire(getHierarchy, { contextRecordId: '$recordId' })
    wiredHierarchy({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.originalData = JSON.parse(JSON.stringify(data));
            console.log('🔍 DEBUG: Raw data from Apex:', JSON.stringify(this.originalData, null, 2));
            this._refreshTreeData();
            this.noCasesFound = this.originalData.id === 'no-cases';
        } else if (error) {
            this.hasError = true;
            this.errorMessage = error.body?.message || JSON.stringify(error);
            console.error('❌ ERROR: Failed to load hierarchy data:', error);
        }
    }

    _refreshTreeData() {
        if (!this.originalData) return;

        console.log('🔄 DEBUG: === REFRESH TREE DATA START ===');
        console.log('🔄 DEBUG: Original data:', JSON.stringify(this.originalData, null, 2));
        console.log('🔄 DEBUG: Current columns:', JSON.stringify(this.columns, null, 2));
        
        const root = JSON.parse(JSON.stringify(this.originalData));
        this._normalise([root]);
        
        console.log('🔄 DEBUG: Normalized root data:', JSON.stringify(root, null, 2));
        
        this.treeData = [root];
        this.expandedRows = [root.id];
        
        console.log('🔄 DEBUG: Final tree data:', JSON.stringify(this.treeData, null, 2));
        console.log('🔄 DEBUG: Expanded rows:', this.expandedRows);
        console.log('🔄 DEBUG: === REFRESH TREE DATA COMPLETE ===');
    }

    _normalise(nodes) {
        nodes.forEach(n => {
            // Create the case URL
            n.caseUrl = n.id !== 'no-cases' ? '/' + n.id : '';
            
            // Ensure all fields exist with defaults
            const defaults = {
                caseNumber: n.caseNumber || 'N/A',
                subject: n.subject || 'No Subject',
                status: n.status || 'Unknown',
                priority: n.priority || 'None',
                caseType: n.caseType || 'Unknown',
                ownerName: n.ownerName || 'Unassigned',
                accountName: n.accountName || 'No Account',
                contactName: n.contactName || 'No Contact',
                origin: n.origin || 'Unknown',
                description: n.description || 'No Description',
                isEscalated: n.isEscalated !== undefined ? n.isEscalated : false,
                isClosed: n.isClosed !== undefined ? n.isClosed : false,
                childCount: n.childCount || 0,
                aeAm: n.aeAm || 'N/A',
                requestorName: n.requestorName || 'N/A',
                requestorEmail: n.requestorEmail || 'N/A',
                requestorPhone: n.requestorPhone || 'N/A',
                requestorCompany: n.requestorCompany || 'N/A'
            };

            // Apply defaults for any missing fields
            Object.keys(defaults).forEach(key => {
                if (n[key] === undefined || n[key] === null) {
                    n[key] = defaults[key];
                }
            });

            // Format dates properly
            if (n.createdDate) {
                try {
                    n.createdDate = new Date(n.createdDate).toISOString();
                } catch (e) {
                    console.warn('Invalid createdDate:', n.createdDate);
                }
            }
            if (n.lastModifiedDate) {
                try {
                    n.lastModifiedDate = new Date(n.lastModifiedDate).toISOString();
                } catch (e) {
                    console.warn('Invalid lastModifiedDate:', n.lastModifiedDate);
                }
            }
            if (n.closedDate) {
                try {
                    n.closedDate = new Date(n.closedDate).toISOString();
                } catch (e) {
                    console.warn('Invalid closedDate:', n.closedDate);
                }
            }

            console.log(`🔍 DEBUG: Normalized node ${n.id}:`, {
                caseNumber: n.caseNumber,
                subject: n.subject,
                status: n.status,
                priority: n.priority,
                ownerName: n.ownerName,
                accountName: n.accountName,
                childCount: n.childCount
            });

            n._children = (n.children && n.children.length) ? n.children : [];
            if (n._children.length) this._normalise(n._children);
        });
    }

    get availableApiNames() {
        return [
            { label: 'Case Number', value: 'caseNumber' },
            { label: 'Subject', value: 'subject' },
            { label: 'Status', value: 'status' },
            { label: 'Priority', value: 'priority' },
            { label: 'Type', value: 'caseType' },
            { label: 'Owner', value: 'ownerName' },
            { label: 'Account', value: 'accountName' },
            { label: 'Contact', value: 'contactName' },
            { label: 'Created Date', value: 'createdDate' },
            { label: 'Last Modified', value: 'lastModifiedDate' },
            { label: 'Closed Date', value: 'closedDate' },
            { label: 'Escalated?', value: 'isEscalated' },
            { label: 'Closed?', value: 'isClosed' },
            { label: 'Child Count', value: 'childCount' },
            { label: 'Origin', value: 'origin' },
            { label: 'Description', value: 'description' },
            { label: 'AE/AM', value: 'aeAm' },
            { label: 'Requestor Name', value: 'requestorName' },
            { label: 'Requestor Email', value: 'requestorEmail' },
            { label: 'Requestor Phone', value: 'requestorPhone' },
            { label: 'Requestor Company', value: 'requestorCompany' }
        ];
    }

    get configColumns() {
        return [
            { 
                label: 'Label', 
                fieldName: 'label', 
                type: 'text', 
                editable: true,
                wrapText: true
            },
            {
                label: 'API Name',
                fieldName: 'fieldName',
                type: 'picklist',
                typeAttributes: {
                    options: { fieldName: 'optionsWithSelection' },
                    placeholder: 'Select API Name',
                    value: { fieldName: 'fieldName' },
                    context: { fieldName: '_id' }
                }
            },
            {
                label: ' ',
                type: 'button-icon',
                initialWidth: 50,
                typeAttributes: {
                    iconName: 'utility:close',
                    alternativeText: 'Remove',
                    name: 'remove',
                    title: 'Remove',
                    variant: 'bare'
                }
            }
        ];
    }

    handleToggleConfig() {
        console.log('🔧 DEBUG: === ENTERING CONFIG MODE ===');
        console.log('🔧 DEBUG: Current columns before config:', JSON.stringify(this.columns, null, 2));
        
        this.isConfigMode = true;
        this.draftColumns = this.columns.map((c, i) => {
            const apiName = this._getApiNameFromColumn(c);
            console.log(`🔧 DEBUG: Column ${i}: "${c.label}" -> API name: "${apiName}"`);
            
            return {
                _id: (i + 1).toString(),
                label: c.label,
                fieldName: apiName,
                type: c.type || 'text',
                optionsWithSelection: this.availableApiNames.map(option => ({
                    ...option,
                    isSelected: option.value === apiName
                }))
            };
        });
        this.draftValues = [];
        
        console.log('🔧 DEBUG: Draft columns created:', JSON.stringify(this.draftColumns, null, 2));
        console.log('🔧 DEBUG: === CONFIG MODE READY ===');
    }

    handleAdd() {
        console.log('➕ DEBUG: Adding new column');
        const newId = (this.draftColumns.length + 1).toString();
        const newColumn = { 
            _id: newId, 
            label: 'New Column', 
            fieldName: 'caseNumber',
            type: 'text',
            optionsWithSelection: this.availableApiNames.map(option => ({
                ...option,
                isSelected: option.value === 'caseNumber'
            }))
        };
        
        this.draftColumns = [...this.draftColumns, newColumn];
        console.log('➕ DEBUG: New column added:', JSON.stringify(newColumn, null, 2));
    }

    handleRowAction(evt) {
        console.log('🗑️ DEBUG: Row action triggered:', JSON.stringify(evt.detail, null, 2));
        
        if (evt.detail.action.name === 'remove') {
            const rowId = evt.detail.row._id;
            console.log(`🗑️ DEBUG: Removing column with ID: ${rowId}`);
            
            this.draftColumns = this.draftColumns.filter(c => c._id !== rowId);
            this.draftValues = this.draftValues.filter(dv => dv._id !== rowId);
            
            // Re-number the remaining columns
            this.draftColumns = this.draftColumns.map((col, index) => ({
                ...col,
                _id: (index + 1).toString()
            }));
            
            console.log('🗑️ DEBUG: Columns after removal:', JSON.stringify(this.draftColumns, null, 2));
        }
    }

    handleCellChange(evt) {
        console.log('📝 DEBUG: === CELL CHANGE EVENT ===');
        console.log('📝 DEBUG: Raw event detail:', JSON.stringify(evt.detail, null, 2));
        
        const newDraftValues = evt.detail.draftValues || [];
        
        newDraftValues.forEach(newDraft => {
            console.log('📝 DEBUG: Processing draft change:', JSON.stringify(newDraft, null, 2));
            
            const rowId = newDraft._id;
            const existingIndex = this.draftValues.findIndex(existing => existing._id === rowId);
            
            // Update draft values
            if (existingIndex !== -1) {
                this.draftValues[existingIndex] = { 
                    ...this.draftValues[existingIndex], 
                    ...newDraft 
                };
            } else {
                this.draftValues.push({ ...newDraft });
            }
            
            // Update the actual draft column data
            const columnIndex = this.draftColumns.findIndex(col => col._id === rowId);
            if (columnIndex !== -1) {
                const updatedColumn = { ...this.draftColumns[columnIndex] };
                
                if (newDraft.fieldName !== undefined) {
                    console.log(`📝 DEBUG: Changing API name from "${updatedColumn.fieldName}" to "${newDraft.fieldName}"`);
                    updatedColumn.fieldName = newDraft.fieldName;
                    
                    // Update the options selection
                    updatedColumn.optionsWithSelection = this.availableApiNames.map(option => ({
                        ...option,
                        isSelected: option.value === newDraft.fieldName
                    }));
                }
                
                if (newDraft.label !== undefined) {
                    console.log(`📝 DEBUG: Changing label from "${updatedColumn.label}" to "${newDraft.label}"`);
                    updatedColumn.label = newDraft.label;
                }
                
                // Replace the column in the array
                this.draftColumns = [
                    ...this.draftColumns.slice(0, columnIndex),
                    updatedColumn,
                    ...this.draftColumns.slice(columnIndex + 1)
                ];
            }
        });
        
        // Force reactivity by creating new arrays
        this.draftValues = [...this.draftValues];
        
        console.log('📝 DEBUG: Updated draft values:', JSON.stringify(this.draftValues, null, 2));
        console.log('📝 DEBUG: Updated draft columns:', JSON.stringify(this.draftColumns, null, 2));
        console.log('📝 DEBUG: === CELL CHANGE COMPLETE ===');
    }

    handleSave() {
        console.log('💾 DEBUG: === SAVE OPERATION START ===');
        console.log('💾 DEBUG: Current draft columns:', JSON.stringify(this.draftColumns, null, 2));
        console.log('💾 DEBUG: Current draft values:', JSON.stringify(this.draftValues, null, 2));
        
        try {
            // Apply any pending draft values to draft columns
            this.draftValues.forEach(draftValue => {
                const columnIndex = this.draftColumns.findIndex(col => col._id === draftValue._id);
                if (columnIndex !== -1) {
                    const updatedColumn = { ...this.draftColumns[columnIndex] };
                    
                    if (draftValue.fieldName !== undefined) {
                        updatedColumn.fieldName = draftValue.fieldName;
                        updatedColumn.optionsWithSelection = this.availableApiNames.map(option => ({
                            ...option,
                            isSelected: option.value === draftValue.fieldName
                        }));
                    }
                    
                    if (draftValue.label !== undefined) {
                        updatedColumn.label = draftValue.label;
                    }
                    
                    this.draftColumns[columnIndex] = updatedColumn;
                }
            });

            console.log('💾 DEBUG: Draft columns after applying draft values:', JSON.stringify(this.draftColumns, null, 2));

            // Build new columns array from current draft state
            const newColumns = this.draftColumns
                .filter(col => {
                    const isValid = col.fieldName && col.label && col.label.trim() !== '';
                    if (!isValid) {
                        console.warn('💾 DEBUG: Filtering out invalid column:', col);
                    }
                    return isValid;
                })
                .map((col, index) => {
                    const builtColumn = this._buildColumn(col.label, col.fieldName);
                    console.log(`💾 DEBUG: Built column ${index}:`, JSON.stringify(builtColumn, null, 2));
                    return builtColumn;
                });

            console.log('💾 DEBUG: Final new columns array:', JSON.stringify(newColumns, null, 2));

            if (newColumns.length === 0) {
                console.error('💾 ERROR: No valid columns to save!');
                return;
            }

            // Exit config mode first
            this.isConfigMode = false;
            this.draftColumns = [];
            this.draftValues = [];

            // Clear everything to force complete re-render
            this.treeData = null;
            this.columns = [];
            this.expandedRows = [];
            
            // Generate new key to force re-render
            const newKey = 'tree-grid-' + Date.now();
            console.log('💾 DEBUG: New tree grid key:', newKey);
            this.treeGridKey = newKey;

            // Set new columns and refresh in next tick
            Promise.resolve().then(() => {
                console.log('💾 DEBUG: Setting new columns...');
                this.columns = [...newColumns];
                
                return Promise.resolve();
            }).then(() => {
                console.log('💾 DEBUG: Refreshing tree data...');
                this._refreshTreeData();
                console.log('💾 DEBUG: Tree data after refresh:', JSON.stringify(this.treeData, null, 2));
                console.log('💾 DEBUG: === SAVE OPERATION COMPLETE ===');
            }).catch(error => {
                console.error('💾 ERROR: Promise chain failed:', error);
            });
            
        } catch (error) {
            console.error('💾 ERROR: Save operation failed:', error);
            this.hasError = true;
            this.errorMessage = 'Failed to save column configuration: ' + error.message;
        }
    }

    handleCancel() {
        console.log('❌ DEBUG: Cancelling config mode');
        this.isConfigMode = false;
        this.draftColumns = [];
        this.draftValues = [];
    }

    _getApiNameFromColumn(column) {
        // Handle special case where caseUrl maps back to caseNumber
        if (column.fieldName === 'caseUrl' && column.type === 'url') {
            return 'caseNumber';
        }
        return column.fieldName;
    }

    _buildColumn(label, fieldName) {
        console.log(`🏗️ DEBUG: Building column "${label}" with fieldName "${fieldName}"`);
        
        const base = { 
            label: label.trim(), 
            fieldName, 
            initialWidth: 120,
            minColumnWidth: 80, 
            maxColumnWidth: 400 
        };

        // Handle special case for case number - it needs to be a URL
        if (fieldName === 'caseNumber') {
            const result = { 
                ...base, 
                fieldName: 'caseUrl',  // Use caseUrl as the actual field
                type: 'url',
                typeAttributes: { 
                    label: { fieldName: 'caseNumber' }, 
                    target: '_blank' 
                } 
            };
            console.log(`🏗️ DEBUG: Built caseNumber as URL column:`, JSON.stringify(result, null, 2));
            return result;
        }

        // Handle other field types
        let result;
        switch (fieldName) {
            case 'subject':
            case 'description':
                result = { ...base, type: 'text', wrapText: true, initialWidth: 300 };
                break;
            case 'childCount':
                result = { ...base, type: 'number', initialWidth: 100 };
                break;
            case 'createdDate':
            case 'lastModifiedDate':
            case 'closedDate':
                result = { ...base, type: 'date', initialWidth: 140 };
                break;
            case 'isEscalated':
            case 'isClosed':
                result = { ...base, type: 'boolean', initialWidth: 110 };
                break;
            case 'requestorEmail':
                result = { ...base, type: 'email', initialWidth: 200 };
                break;
            case 'requestorPhone':
                result = { ...base, type: 'phone', initialWidth: 150 };
                break;
            default:
                result = { ...base, type: 'text' };
                break;
        }
        
        console.log(`🏗️ DEBUG: Built column result:`, JSON.stringify(result, null, 2));
        return result;
    }

    handleRowToggle(e) {
        this.expandedRows = e.detail.expandedRows;
        console.log('🌳 DEBUG: Row toggle - expanded rows:', this.expandedRows);
    }

    // Debug method to test data structure
    debugDataStructure() {
        console.log('🧪 DEBUG: === DATA STRUCTURE TEST ===');
        console.log('🧪 DEBUG: Current columns:', JSON.stringify(this.columns, null, 2));
        console.log('🧪 DEBUG: Current tree data:', JSON.stringify(this.treeData, null, 2));
        
        if (this.treeData && this.treeData.length > 0) {
            const firstNode = this.treeData[0];
            console.log('🧪 DEBUG: First node properties:');
            Object.keys(firstNode).forEach(key => {
                console.log(`🧪   ${key}: ${firstNode[key]}`);
            });
            
            if (firstNode._children && firstNode._children.length > 0) {
                const firstChild = firstNode._children[0];
                console.log('🧪 DEBUG: First child properties:');
                Object.keys(firstChild).forEach(key => {
                    console.log(`🧪   ${key}: ${firstChild[key]}`);
                });
            }
        }
        console.log('🧪 DEBUG: === DATA STRUCTURE TEST COMPLETE ===');
    }

    // Add this method to be called from browser console for debugging
    connectedCallback() {
        // Expose debug method to global scope for testing
        window.debugCaseHierarchy = () => this.debugDataStructure();
    }
}