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

    treeData;
    expandedRows = [];
    isLoading = true;
    noCasesFound = false;
    hasError = false;
    errorMessage = '';

    @wire(getHierarchy, { contextRecordId: '$recordId' })
    wiredHierarchy({ data, error }) {
        this.isLoading = false;
        if (data) {
            const root = JSON.parse(JSON.stringify(data));
            this._normalise([root]);
            this.treeData = [root];
            this.expandedRows = [root.id];
            this.noCasesFound = root.childCount === 0;
        } else if (error) {
            this.hasError = true;
            this.errorMessage = error.body?.message || JSON.stringify(error);
        }
    }

    _normalise(nodes) {
        nodes.forEach(n => {
            n.caseUrl = '/' + n.id;
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
                editable: true,
                typeAttributes: {
                    options: this.availableApiNames,
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
        this.isConfigMode = true;
        this.draftColumns = this.columns.map((c, i) => ({ 
            ...c, 
            _id: (i + 1).toString(), // Use i+1 to start from 1 instead of 0
            // Ensure we have the actual fieldName for the picklist
            fieldName: c.fieldName
        }));
        this.draftValues = [];
    }

    handleAdd() {
        const newId = (this.draftColumns.length + 1).toString(); // Use sequential numbering
        this.draftColumns = [
            ...this.draftColumns,
            { 
                _id: newId, 
                label: 'New Column', 
                fieldName: 'caseNumber',
                type: 'text'
            }
        ];
    }

    handleRowAction(evt) {
        if (evt.detail.action.name === 'remove') {
            const rowId = evt.detail.row._id;
            this.draftColumns = this.draftColumns.filter(c => c._id !== rowId);
            // Also remove any draft values for this row
            this.draftValues = this.draftValues.filter(dv => dv._id !== rowId);
            
            // Re-number the remaining columns to maintain sequential numbering
            this.draftColumns = this.draftColumns.map((col, index) => ({
                ...col,
                _id: (index + 1).toString()
            }));
        }
    }

    handleCellChange(evt) {
        console.log('Cell change event:', evt.detail);
        const newDraftValues = evt.detail.draftValues;
        
        // Merge with existing draft values
        newDraftValues.forEach(newDraft => {
            const existingIndex = this.draftValues.findIndex(existing => existing._id === newDraft._id);
            if (existingIndex !== -1) {
                // Update existing draft value
                this.draftValues[existingIndex] = { ...this.draftValues[existingIndex], ...newDraft };
            } else {
                // Add new draft value
                this.draftValues.push(newDraft);
            }
        });
        
        console.log('Updated draft values:', this.draftValues);
        
        // Force a re-render by updating the draftValues array reference
        this.draftValues = [...this.draftValues];
    }

    handleSave() {
        console.log('Saving with draft values:', this.draftValues);
        
        // Apply all draft values to the draft columns
        this.draftValues.forEach(draftValue => {
            const columnIndex = this.draftColumns.findIndex(col => col._id === draftValue._id);
            if (columnIndex !== -1) {
                // Update the column with the draft values
                this.draftColumns[columnIndex] = { 
                    ...this.draftColumns[columnIndex], 
                    ...draftValue 
                };
            }
        });

        // Build final columns from draft columns
        this.columns = this.draftColumns.map(({ label, fieldName }) => {
            return this._buildColumn(label, fieldName);
        });

        console.log('Final columns:', this.columns);

        // Exit config mode
        this.isConfigMode = false;
        this.draftColumns = [];
        this.draftValues = [];
    }

    handleCancel() {
        this.isConfigMode = false;
        this.draftColumns = [];
        this.draftValues = [];
    }

    _buildColumn(label, fieldName) {
        const base = { 
            label, 
            fieldName, 
            initialWidth: 120,
            minColumnWidth: 80, 
            maxColumnWidth: 400 
        };

        switch (fieldName) {
            case 'caseUrl':
                return { 
                    ...base, 
                    type: 'url',
                    typeAttributes: { 
                        label: { fieldName: 'caseNumber' }, 
                        target: '_blank' 
                    } 
                };
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
            default:
                return base;
        }
    }

    handleRowToggle(e) {
        this.expandedRows = e.detail.expandedRows;
    }
}