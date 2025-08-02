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
    @track treeGridKey = 'tree-grid-1'; // Add key for forcing re-render

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
        }
    }

    _refreshTreeData() {
        if (!this.originalData) return;

        console.log('🔄 DEBUG: Refreshing tree data with current columns:', JSON.stringify(this.columns, null, 2));
        
        const root = JSON.parse(JSON.stringify(this.originalData));
        this._normalise([root]);
        this.treeData = [root];
        this.expandedRows = [root.id];
        
        console.log('✅ DEBUG: Tree data refreshed:', JSON.stringify(this.treeData, null, 2));
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

            // Apply defaults
            Object.keys(defaults).forEach(key => {
                if (n[key] === undefined || n[key] === null) {
                    n[key] = defaults[key];
                }
            });

            console.log(`🔍 DEBUG: Normalized node ${n.id}:`, {
                caseNumber: n.caseNumber,
                subject: n.subject,
                status: n.status,
                priority: n.priority,
                ownerName: n.ownerName,
                accountName: n.accountName
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
        console.log('🔧 DEBUG: Entering config mode');
        console.log('🔧 DEBUG: Current columns before config:', JSON.stringify(this.columns, null, 2));
        
        this.isConfigMode = true;
        this.draftColumns = this.columns.map((c, i) => {
            const apiName = this._getApiNameFromColumn(c);
            console.log(`🔧 DEBUG: Column ${i}: "${c.label}" -> "${apiName}"`);
            
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
    }

    handleAdd() {
        const newId = (this.draftColumns.length + 1).toString();
        this.draftColumns = [
            ...this.draftColumns,
            { 
                _id: newId, 
                label: 'New Column', 
                fieldName: 'caseNumber',
                type: 'text',
                optionsWithSelection: this.availableApiNames.map(option => ({
                    ...option,
                    isSelected: option.value === 'caseNumber'
                }))
            }
        ];
    }

    handleRowAction(evt) {
        if (evt.detail.action.name === 'remove') {
            const rowId = evt.detail.row._id;
            this.draftColumns = this.draftColumns.filter(c => c._id !== rowId);
            this.draftValues = this.draftValues.filter(dv => dv._id !== rowId);
            
            // Re-number the remaining columns
            this.draftColumns = this.draftColumns.map((col, index) => ({
                ...col,
                _id: (index + 1).toString()
            }));
        }
    }

    handleCellChange(evt) {
        console.log('📝 DEBUG: Cell change event:', JSON.stringify(evt.detail, null, 2));
        
        const newDraftValues = evt.detail.draftValues || [];
        
        newDraftValues.forEach(newDraft => {
            console.log('📝 DEBUG: Processing draft:', JSON.stringify(newDraft, null, 2));
            
            const rowId = newDraft._id;
            const existingIndex = this.draftValues.findIndex(existing => existing._id === rowId);
            
            if (existingIndex !== -1) {
                this.draftValues[existingIndex] = { 
                    ...this.draftValues[existingIndex], 
                    ...newDraft 
                };
            } else {
                this.draftValues.push({ ...newDraft });
            }
            
            // Update the draft column
            const columnIndex = this.draftColumns.findIndex(col => col._id === rowId);
            if (columnIndex !== -1) {
                const updatedColumn = { ...this.draftColumns[columnIndex] };
                
                if (newDraft.fieldName !== undefined) {
                    console.log(`📝 DEBUG: Changing API name from "${updatedColumn.fieldName}" to "${newDraft.fieldName}"`);
                    updatedColumn.fieldName = newDraft.fieldName;
                    updatedColumn.optionsWithSelection = this.availableApiNames.map(option => ({
                        ...option,
                        isSelected: option.value === newDraft.fieldName
                    }));
                }
                
                if (newDraft.label !== undefined) {
                    console.log(`📝 DEBUG: Changing label from "${updatedColumn.label}" to "${newDraft.label}"`);
                    updatedColumn.label = newDraft.label;
                }
                
                this.draftColumns[columnIndex] = updatedColumn;
            }
        });
        
        // Force reactivity
        this.draftValues = [...this.draftValues];
        this.draftColumns = [...this.draftColumns];
        
        console.log('📝 DEBUG: Updated draft columns:', JSON.stringify(this.draftColumns, null, 2));
    }

    handleSave() {
        console.log('💾 DEBUG: === SAVE OPERATION START ===');
        console.log('💾 DEBUG: Draft columns to process:', JSON.stringify(this.draftColumns, null, 2));
        
        // Build new columns array
        const newColumns = this.draftColumns
            .filter(col => col.fieldName && col.label && col.label.trim() !== '')
            .map((col, index) => {
                const builtColumn = this._buildColumn(col.label, col.fieldName);
                console.log(`💾 DEBUG: Built column ${index}:`, JSON.stringify(builtColumn, null, 2));
                return builtColumn;
            });

        console.log('💾 DEBUG: Final new columns array:', JSON.stringify(newColumns, null, 2));

        // Exit config mode first
        this.isConfigMode = false;
        this.draftColumns = [];
        this.draftValues = [];

        // Force complete refresh by clearing everything first
        console.log('💾 DEBUG: Clearing tree data and columns...');
        this.treeData = null;
        this.columns = [];
        this.expandedRows = [];

        // Use setTimeout to ensure the clear is processed before setting new data
        setTimeout(() => {
            console.log('💾 DEBUG: Setting new columns and refreshing data...');
            this.columns = [...newColumns];
            this.treeGridKey = 'tree-grid-' + Date.now(); // Force complete re-render
            this._refreshTreeData();
        }, 50);
        
        console.log('💾 DEBUG: === SAVE OPERATION END ===');
    }

    handleCancel() {
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
            label, 
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
        switch (fieldName) {
            case 'subject':
            case 'description':
                return { ...base, wrapText: true, initialWidth: 300 };
            case 'childCount':
                return { ...base, type: 'number', initialWidth: 100 };
            case 'createdDate':
            case 'lastModifiedDate':
            case 'closedDate':
                return { ...base, type: 'date', initialWidth: 140 };
            case 'isEscalated':
            case 'isClosed':
                return { ...base, type: 'boolean', initialWidth: 110 };
            case 'requestorEmail':
                return { ...base, type: 'email', initialWidth: 200 };
            case 'requestorPhone':
                return { ...base, type: 'phone', initialWidth: 150 };
            default:
                const result = { ...base, type: 'text' };
                console.log(`🏗️ DEBUG: Built default text column:`, JSON.stringify(result, null, 2));
                return result;
        }
    }

    handleRowToggle(e) {
        this.expandedRows = e.detail.expandedRows;
    }
}